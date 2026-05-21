-- Migración: Actualiza funciones RPC de trading para limpiar reservas de cromos

-- Reemplaza execute_trade para eliminar asset_reservations del vendedor
DROP FUNCTION IF EXISTS public.execute_trade(UUID);
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

  -- Bloquear filas de user_stickers relevantes
  SELECT * INTO v_seller_row FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_offered FOR UPDATE;
  IF NOT FOUND OR v_seller_row.quantity <= 0 THEN
    RAISE EXCEPTION 'seller_no_longer_has';
  END IF;

  SELECT * INTO v_buyer_row FROM user_stickers WHERE user_id = v_buyer_id AND sticker_id = v_wanted FOR UPDATE;
  IF NOT FOUND OR v_buyer_row.quantity <= 0 THEN
    RAISE EXCEPTION 'buyer_lacks_wanted';
  END IF;

  -- Validaciones de "pegado": si qty = 1, no debe estar pegado
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

  -- Ejecutar transferencias: decrementar y upsert
  IF v_seller_row.quantity > 1 THEN
    UPDATE user_stickers SET quantity = v_seller_row.quantity - 1 WHERE id = v_seller_row.id;
  ELSE
    DELETE FROM user_stickers WHERE id = v_seller_row.id;
  END IF;

  -- Dar al comprador el cromo ofrecido
  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_buyer_id, v_offered, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  -- Decrementar el cromo del comprador (wanted)
  IF v_buyer_row.quantity > 1 THEN
    UPDATE user_stickers SET quantity = v_buyer_row.quantity - 1 WHERE id = v_buyer_row.id;
  ELSE
    DELETE FROM user_stickers WHERE id = v_buyer_row.id;
  END IF;

  -- Dar al vendedor el cromo wanted
  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_seller_id, v_wanted, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  -- Eliminar reserva del vendedor si existe
  DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_offered;

  -- Marcar trade como accepted
  UPDATE trade_offers SET status = 'accepted', target_user_id = v_buyer_id, updated_at = now() WHERE id = p_trade_id;

  RETURN jsonb_build_object('status','ok');
EXCEPTION WHEN others THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_trade(TEXT) TO authenticated;

-- Reemplaza finalize_auction para limpiar reservas
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
    -- No hubo pujadores: marcar como finished y eliminar reserva
    DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_sticker;
    UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;
    RETURN jsonb_build_object('status', 'no_bids');
  END IF;

  -- Bloquear perfiles y filas relevantes
  SELECT * INTO v_winner_profile FROM user_profiles WHERE user_id = v_winner_id FOR UPDATE;
  SELECT * INTO v_seller_profile FROM user_profiles WHERE user_id = v_seller_id FOR UPDATE;

  IF v_winner_profile.coins < v_auction.highest_bid THEN
    RAISE EXCEPTION 'winner_insufficient_coins';
  END IF;

  -- Transferir monedas
  UPDATE user_profiles SET coins = v_winner_profile.coins - v_auction.highest_bid WHERE user_id = v_winner_id;
  UPDATE user_profiles SET coins = v_seller_profile.coins + v_auction.highest_bid WHERE user_id = v_seller_id;

  -- Transferir cromo: decrementar del vendedor, incrementar del ganador
  IF EXISTS (SELECT 1 FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker) THEN
    -- Decrementar o eliminar
    UPDATE user_stickers SET quantity = user_stickers.quantity - 1
      WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity > 1;
    DELETE FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity = 1;
  ELSE
    RAISE EXCEPTION 'seller_no_longer_has_sticker';
  END IF;

  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_winner_id, v_sticker, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  -- Eliminar reserva del vendedor
  DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_sticker;

  UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;
