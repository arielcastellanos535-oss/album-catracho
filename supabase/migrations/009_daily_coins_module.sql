-- Migración 009: módulo de monedas diarias y estado de monedas

-- Columnas de soporte para la recompensa diaria de monedas
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS coins_claimed_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_coin_date DATE;

-- Historial de transacciones de monedas
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  category TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON public.coin_transactions(user_id);

-- Función para reclamar 3 monedas gratis diarias (no acumulables)
CREATE OR REPLACE FUNCTION public.claim_daily_coins()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid()::uuid;
  today DATE := (timezone('America/Tegucigalpa', now()))::date;
  prof user_profiles%ROWTYPE;
  new_balance INT;
  next_claim TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO prof FROM user_profiles WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id) VALUES (uid);
    SELECT * INTO prof FROM user_profiles WHERE user_id = uid FOR UPDATE;
  END IF;

  IF prof.last_coin_date IS DISTINCT FROM today THEN
    UPDATE user_profiles
    SET last_coin_date = today, coins_claimed_today = 0, updated_at = now()
    WHERE user_id = uid;
    prof.coins_claimed_today := 0;
    prof.last_coin_date := today;
  END IF;

  IF prof.coins_claimed_today >= 3 THEN
    RAISE EXCEPTION 'daily_coins_already_claimed';
  END IF;

  new_balance := prof.coins + 3;

  UPDATE user_profiles
  SET coins = new_balance,
      coins_claimed_today = 3,
      last_coin_date = today,
      updated_at = now()
  WHERE user_id = uid;

  INSERT INTO public.coin_transactions (user_id, amount, direction, category, source)
  VALUES (uid, 3, 'credit', 'daily_reward', 'daily_free_coins');

  next_claim := (timezone('America/Tegucigalpa', now())::date + interval '1 day');

  RETURN jsonb_build_object(
    'status', 'ok',
    'coins', new_balance,
    'daily_coins_today', 3,
    'next_claim_at', next_claim
  );
END;
$$;

-- Función que devuelve el panel de monedas para el usuario actual
CREATE OR REPLACE FUNCTION public.get_coin_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid()::uuid;
  today DATE := (timezone('America/Tegucigalpa', now()))::date;
  prof user_profiles%ROWTYPE;
  totals RECORD;
  frozen INT := 0;
  next_claim TIMESTAMPTZ;
  initial_coins INT := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO prof FROM user_profiles WHERE user_id = uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'current_balance', 0,
      'initial_coins', 0,
      'coins_earned', 0,
      'coins_spent', 0,
      'frozen_coins', 0,
      'coins_available', 0,
      'daily_coins_today', 0,
      'daily_claimable', true,
      'next_claim_at', (timezone('America/Tegucigalpa', now())::date + interval '1 day')
    );
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) AS credits,
    COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) AS debits
  INTO totals
  FROM public.coin_transactions
  WHERE user_id = uid;

  SELECT COALESCE(SUM(amount), 0) INTO frozen
  FROM public.coin_reservations
  WHERE user_id = uid;

  SELECT COALESCE(SUM(amount), 0) INTO initial_coins
  FROM public.coin_transactions
  WHERE user_id = uid AND category = 'initial';

  next_claim := (timezone('America/Tegucigalpa', now())::date + interval '1 day');

  RETURN jsonb_build_object(
    'current_balance', prof.coins,
    'initial_coins', initial_coins,
    'coins_earned', COALESCE(totals.credits, 0) - initial_coins,
    'coins_spent', totals.debits,
    'frozen_coins', frozen,
    'coins_available', prof.coins - frozen,
    'daily_coins_today', COALESCE(prof.coins_claimed_today, 0),
    'daily_claimable', prof.last_coin_date IS DISTINCT FROM today,
    'next_claim_at', next_claim
  );
END;
$$;

-- Actualizar finalize_auction para registrar transacciones de monedas
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

  INSERT INTO public.coin_transactions (user_id, amount, direction, category, source)
  VALUES (v_winner_id, v_auction.highest_bid, 'debit', 'auction_purchase', 'auction');

  INSERT INTO public.coin_transactions (user_id, amount, direction, category, source)
  VALUES (v_seller_id, v_auction.highest_bid, 'credit', 'auction_sale', 'auction');

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

-- Actualizar trigger de nuevo usuario para crear transacción inicial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Catracho'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.coin_transactions (user_id, amount, direction, category, source)
  VALUES (NEW.id, 50, 'credit', 'initial', 'signup');

  RETURN NEW;
END;
$$;

-- Mantener datos históricos de usuarios existentes
INSERT INTO public.coin_transactions (user_id, amount, direction, category, source)
SELECT user_id, coins, 'credit', 'initial', 'migration_existing_user'
FROM public.user_profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.coin_transactions ct
  WHERE ct.user_id = p.user_id
    AND ct.category = 'initial'
);

ALTER TABLE IF EXISTS public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY coin_transactions_select_own ON public.coin_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::uuid);

CREATE POLICY coin_transactions_insert_own ON public.coin_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::uuid);

GRANT EXECUTE ON FUNCTION public.claim_daily_coins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coin_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
