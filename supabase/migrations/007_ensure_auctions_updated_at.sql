-- Migración: Asegura que la tabla auctions tenga la columna updated_at para las funciones de subastas

ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE trade_offers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
