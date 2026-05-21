-- Migración: Tablas y funciones para módulo de trading (ofertas y subastas)

-- Tablas: trade_offers, auctions, asset_reservations, coin_reservations
CREATE TABLE IF NOT EXISTS trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id_offered UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  sticker_id_wanted UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | cancelled
  target_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_offer_id UUID NULL REFERENCES trade_offers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_bet INT NOT NULL DEFAULT 10,
  highest_bid INT NOT NULL DEFAULT 0,
  highest_bidder_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | finished | cancelled
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservas de cromos (congelar mientras hay oferta/subasta)
CREATE TABLE IF NOT EXISTS asset_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sticker_id)
);

-- Reservas de monedas (congelar cuando se puja)
CREATE TABLE IF NOT EXISTS coin_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount >= 0),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: habilitar en nuevas tablas
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_reservations ENABLE ROW LEVEL SECURITY;

-- Políticas: trade_offers
CREATE POLICY trade_offers_select_public ON trade_offers FOR SELECT TO authenticated USING (status = 'pending' AND target_user_id IS NULL);
CREATE POLICY trade_offers_insert_own ON trade_offers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY trade_offers_update_owner_or_target ON trade_offers FOR UPDATE TO authenticated USING (user_id = auth.uid()::uuid OR target_user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid OR target_user_id = auth.uid()::uuid);

-- Políticas: auctions
CREATE POLICY auctions_select ON auctions FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY auctions_insert_own ON auctions FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid()::uuid);
CREATE POLICY auctions_update_seller ON auctions FOR UPDATE TO authenticated USING (seller_id = auth.uid()::uuid) WITH CHECK (seller_id = auth.uid()::uuid);

-- Políticas: reservations (solo dueño puede CRUD)
CREATE POLICY asset_reservations_own ON asset_reservations FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY coin_reservations_own ON coin_reservations FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);

-- RPC: intercambio atómico (aceptar oferta)
CREATE OR REPLACE FUNCTION public.execute_trade(p_trade_id UUID)
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

  -- Marcar trade como accepted
  UPDATE trade_offers SET status = 'accepted', target_user_id = v_buyer_id, updated_at = now() WHERE id = p_trade_id;

  RETURN jsonb_build_object('status','ok');
EXCEPTION WHEN others THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_trade(UUID) TO authenticated;

-- RPC: finalizar subasta (transferencia de cromo al ganador y cobro de monedas)
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
    -- No hubo pujadores: marcar como finished sin transferencias
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
  -- Asumimos que vendedor tenía reservada la copia (o al menos la tenía). Bloquear row
  IF EXISTS (SELECT 1 FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker) THEN
    UPDATE user_stickers SET quantity = user_stickers.quantity - 1
      WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity > 1;
    DELETE FROM user_stickers WHERE user_id = v_seller_id AND sticker_id = v_sticker AND user_stickers.quantity = 1;
  ELSE
    -- si no tiene, proceder pero loguear (no revertimos monedas aquí)
    RAISE EXCEPTION 'seller_no_longer_has_sticker';
  END IF;

  INSERT INTO user_stickers (user_id, sticker_id, quantity, first_obtained_at)
  VALUES (v_winner_id, v_sticker, 1, now())
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET quantity = user_stickers.quantity + 1;

  UPDATE auctions SET status = 'finished', updated_at = now() WHERE id = p_auction_id;

  RETURN jsonb_build_object('status','ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_asset_reservations_user ON asset_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_reservations_user ON coin_reservations(user_id);

-- FIN
