-- Migración: Añade auction_id a coin_reservations y función place_bid

ALTER TABLE coin_reservations ADD COLUMN IF NOT EXISTS auction_id UUID NULL REFERENCES auctions(id) ON DELETE CASCADE;

-- Asegurar que cada reserva de moneda para una subasta sea única por usuario y subasta
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_reservation_user_auction ON coin_reservations(user_id, auction_id);

-- Función place_bid: realiza la puja, reserva monedas y libera la reserva anterior
CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id UUID, p_bid INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_user UUID := auth.uid();
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

  -- Bloquear perfil y calcular monedas disponibles (incluyendo reservas)
  SELECT * INTO v_profile FROM user_profiles WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_reserved_sum FROM coin_reservations WHERE user_id = v_user AND auction_id IS DISTINCT FROM p_auction_id;

  IF v_profile.coins - v_reserved_sum < p_bid THEN
    RAISE EXCEPTION 'insufficient_coins_after_reservations';
  END IF;

  -- Registrar reserva del ofertante actual (si ya existe, actualizar)
  INSERT INTO coin_reservations (user_id, amount, auction_id, created_at)
  VALUES (v_user, p_bid, p_auction_id, now())
  ON CONFLICT (user_id, auction_id) DO UPDATE SET amount = EXCLUDED.amount, created_at = now();

  -- Liberar reserva previa del mejor postor anterior (si no es el mismo usuario)
  v_prev_bidder := v_auction.highest_bidder_id;
  v_prev_amount := v_auction.highest_bid;

  IF v_prev_bidder IS NOT NULL AND v_prev_bidder <> v_user THEN
    DELETE FROM coin_reservations WHERE user_id = v_prev_bidder AND auction_id = p_auction_id;
  END IF;

  -- Actualizar subasta con nuevo mejor postor
  UPDATE auctions SET highest_bid = p_bid, highest_bidder_id = v_user, updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_bid(UUID, INT) TO authenticated;
