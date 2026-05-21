-- Migración 008: Sincroniza el esquema de trading con el estado actual de Supabase

BEGIN;

-- Asegurar la tabla de subastas y pujas extra
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  amount INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.coin_reservations
  ADD COLUMN IF NOT EXISTS auction_id UUID NULL REFERENCES public.auctions(id) ON DELETE CASCADE;

-- Actualizar políticas para evitar errores de tipos text/uuid
DROP POLICY IF EXISTS trade_offers_select_public ON public.trade_offers;
DROP POLICY IF EXISTS trade_offers_insert_own ON public.trade_offers;
DROP POLICY IF EXISTS trade_offers_update_owner_or_target ON public.trade_offers;
DROP POLICY IF EXISTS auctions_select ON public.auctions;
DROP POLICY IF EXISTS auctions_insert_own ON public.auctions;
DROP POLICY IF EXISTS auctions_update_seller ON public.auctions;
DROP POLICY IF EXISTS asset_reservations_own ON public.asset_reservations;
DROP POLICY IF EXISTS coin_reservations_own ON public.coin_reservations;

CREATE POLICY trade_offers_select_public ON public.trade_offers FOR SELECT TO authenticated USING (status = 'pending' AND target_user_id IS NULL);
CREATE POLICY trade_offers_insert_own ON public.trade_offers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY trade_offers_update_owner_or_target ON public.trade_offers FOR UPDATE TO authenticated USING (user_id = auth.uid()::uuid OR target_user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid OR target_user_id = auth.uid()::uuid);

CREATE POLICY auctions_select ON public.auctions FOR SELECT TO authenticated USING ((status = 'active'::text) AND (expires_at > now()));
CREATE POLICY auctions_insert_own ON public.auctions FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid()::uuid);
CREATE POLICY auctions_update_seller ON public.auctions FOR UPDATE TO authenticated USING (seller_id = auth.uid()::uuid) WITH CHECK (seller_id = auth.uid()::uuid);

CREATE POLICY asset_reservations_own ON public.asset_reservations FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY coin_reservations_own ON public.coin_reservations FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

-- Asegurar RLS activado en las tablas trading
ALTER TABLE IF EXISTS public.trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asset_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_reservations ENABLE ROW LEVEL SECURITY;

-- RPC actualizados
CREATE OR REPLACE FUNCTION public.execute_trade(p_trade_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_seller_id UUID;
  v_buyer_id UUID := auth.uid()::uuid;
  v_offered UUID;
  v_wanted UUID;
  v_seller_row RECORD;
  v_buyer_row RECORD;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_trade FROM trade_offers WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trade_not_found';
  END IF;

  IF v_trade.status <> 'pending' THEN
    RAISE EXCEPTION 'trade_not_pending';
  END IF;

  v_seller_id := v_trade.user_id;
  IF v_seller_id = v_buyer_id THEN
    RAISE EXCEPTION 'cannot_accept_own_trade';
  END IF;

  v_offered := v_trade.sticker_id_offered;
  v_wanted := v_trade.sticker_id_wanted;

  SELECT * INTO v_seller_row FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_offered FOR UPDATE;
  IF NOT FOUND OR v_seller_row.quantity <= 0 THEN
    RAISE EXCEPTION 'seller_no_longer_has';
  END IF;

  SELECT * INTO v_buyer_row FROM user_stickers WHERE user_id = v_buyer_id AND sticker_id = v_wanted FOR UPDATE;
  IF NOT FOUND OR v_buyer_row.quantity <= 0 THEN
    RAISE EXCEPTION 'buyer_lacks_wanted';
  END IF;

  IF v_seller_row.quantity = 1 THEN
    IF EXISTS (SELECT 1 FROM user_album_slots WHERE user_id = v_seller_id AND sticker_id = v_offered) THEN
      RAISE EXCEPTION 'seller_offered_pasted';
    END IF;
  END IF;

  IF v_buyer_row.quantity = 1 THEN
    IF EXISTS (SELECT 1 FROM user_album_slots WHERE user_id = v_buyer_id AND sticker_id = v_wanted) THEN
      RAISE EXCEPTION 'buyer_wanted_pasted';
    END IF;
  END IF;

  IF v_seller_row.quantity > 1 THEN
    UPDATE user_stickers SET quantity = v_seller_row.quantity - 1 WHERE id = v_seller_row.id;
  ELSE
    DELETE FROM user_stickers WHERE id = v_seller_row.id;
  END IF;

  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_buyer_id, v_offered, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  IF v_buyer_row.quantity > 1 THEN
    UPDATE user_stickers SET quantity = v_buyer_row.quantity - 1 WHERE id = v_buyer_row.id;
  ELSE
    DELETE FROM user_stickers WHERE id = v_buyer_row.id;
  END IF;

  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_seller_id, v_wanted, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_offered;

  UPDATE trade_offers SET status = 'accepted', target_user_id = v_buyer_id, updated_at = now() WHERE id = p_trade_id;

  RETURN jsonb_build_object('status','ok');
EXCEPTION WHEN others THEN
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id UUID, p_bid INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_user UUID := auth.uid()::uuid;
  v_profile RECORD;
  v_prev_bidder UUID;
  v_prev_amount INT;
  v_reserved_sum INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found';
  END IF;
  IF v_auction.status <> 'active' THEN
    RAISE EXCEPTION 'auction_not_active';
  END IF;
  IF v_auction.expires_at IS NOT NULL AND v_auction.expires_at <= now() THEN
    RAISE EXCEPTION 'auction_expired';
  END IF;
  IF p_bid <= v_auction.highest_bid THEN
    RAISE EXCEPTION 'bid_too_low';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_reserved_sum FROM coin_reservations WHERE user_id = v_user AND auction_id IS DISTINCT FROM p_auction_id;

  IF v_profile.coins - v_reserved_sum < p_bid THEN
    RAISE EXCEPTION 'insufficient_coins_after_reservations';
  END IF;

  INSERT INTO coin_reservations (user_id, amount, auction_id, created_at)
  VALUES (v_user, p_bid, p_auction_id, now())
  ON CONFLICT (user_id, auction_id) DO UPDATE SET amount = EXCLUDED.amount, created_at = now();

  v_prev_bidder := v_auction.highest_bidder_id;
  v_prev_amount := v_auction.highest_bid;

  IF v_prev_bidder IS NOT NULL AND v_prev_bidder <> v_user THEN
    DELETE FROM coin_reservations WHERE user_id = v_prev_bidder AND auction_id = p_auction_id;
  END IF;

  UPDATE auctions SET highest_bid = p_bid, highest_bidder_id = v_user, updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_auction(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_seller_id UUID;
  v_winner_id UUID;
  v_sticker UUID;
  v_winner_profile RECORD;
  v_seller_profile RECORD;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found';
  END IF;
  IF v_auction.status <> 'active' THEN
    RAISE EXCEPTION 'auction_not_active';
  END IF;
  IF v_auction.expires_at > now() THEN
    RAISE EXCEPTION 'auction_not_expired';
  END IF;

  v_seller_id := v_auction.seller_id;
  v_winner_id := v_auction.highest_bidder_id;
  v_sticker := v_auction.sticker_id;

  IF v_winner_id IS NULL THEN
    DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_sticker;
    UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;
    RETURN jsonb_build_object('status', 'no_bids');
  END IF;

  SELECT * INTO v_winner_profile FROM user_profiles WHERE user_id = v_winner_id FOR UPDATE;
  SELECT * INTO v_seller_profile FROM user_profiles WHERE user_id = v_seller_id FOR UPDATE;

  IF v_winner_profile.coins < v_auction.highest_bid THEN
    RAISE EXCEPTION 'winner_insufficient_coins';
  END IF;

  DELETE FROM coin_reservations WHERE user_id = v_winner_id AND auction_id = p_auction_id;

  UPDATE user_profiles SET coins = v_winner_profile.coins - v_auction.highest_bid WHERE user_id = v_winner_id;
  UPDATE user_profiles SET coins = v_seller_profile.coins + v_auction.highest_bid WHERE user_id = v_seller_id;

  IF EXISTS (SELECT 1 FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker) THEN
    UPDATE user_stickers SET quantity = user_stickers.quantity - 1
      WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity > 1;
    DELETE FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity = 1;
  ELSE
    RAISE EXCEPTION 'seller_no_longer_has_sticker';
  END IF;

  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_winner_id, v_sticker, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_sticker;

  UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_count INT := 0;
BEGIN
  FOR v_auction IN
    SELECT id FROM auctions
    WHERE status = 'active' AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.finalize_auction(v_auction.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'finalize_expired_auctions failed for auction %, error: %', v_auction.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('finalized_count', v_count);
END;
$$;

COMMIT;
