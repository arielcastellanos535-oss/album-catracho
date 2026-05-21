-- Migración: Arregla la limpieza de reservas en finalize_auction y agrega batch de finalización de subastas expiradas

-- Actualiza finalize_auction para eliminar coin_reservations del ganador y mantener consistencia
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

  -- Bloquear perfiles y filas relevantes
  SELECT * INTO v_winner_profile FROM user_profiles WHERE user_id = v_winner_id FOR UPDATE;
  SELECT * INTO v_seller_profile FROM user_profiles WHERE user_id = v_seller_id FOR UPDATE;

  IF v_winner_profile.coins < v_auction.highest_bid THEN
    RAISE EXCEPTION 'winner_insufficient_coins';
  END IF;

  -- Eliminar reserva de monedas del ganador para esta subasta
  DELETE FROM coin_reservations WHERE user_id = v_winner_id AND auction_id = p_auction_id;

  -- Transferir monedas
  UPDATE user_profiles SET coins = v_winner_profile.coins - v_auction.highest_bid WHERE user_id = v_winner_id;
  UPDATE user_profiles SET coins = v_seller_profile.coins + v_auction.highest_bid WHERE user_id = v_seller_id;

  -- Transferir cromo: decrementar del vendedor, incrementar del ganador
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

  -- Eliminar reserva del vendedor
  DELETE FROM asset_reservations WHERE user_id = v_seller_id AND sticker_id = v_sticker;

  UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;

-- Función batch para finalizar todas las subastas expiradas
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
      -- Ignorar subastas problemáticas para permitir continuar con las demás
      RAISE NOTICE 'finalize_expired_auctions failed for auction %, error: %', v_auction.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('finalized_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_expired_auctions() TO authenticated;
