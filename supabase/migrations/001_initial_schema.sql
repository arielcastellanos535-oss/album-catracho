-- Album Catracho — esquema MVP
-- Ejecutar en Supabase SQL Editor o: supabase db push

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'sticker_rarity'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.sticker_rarity AS ENUM ('common', 'silver', 'special');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pack_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pack_type AS ENUM ('normal', 'silver', 'gold');
  END IF;
END
$$;

-- Departamentos (18 Honduras; MVP activo en 2)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  page_order INT NOT NULL,
  slots_count INT NOT NULL DEFAULT 5,
  is_mvp_active BOOLEAN NOT NULL DEFAULT false,
  fact_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,
  number INT NOT NULL,
  name TEXT NOT NULL,
  fact_text TEXT,
  image_url TEXT,
  rarity sticker_rarity NOT NULL DEFAULT 'common',
  is_mvp BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, slot_index)
);

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  coins INT NOT NULL DEFAULT 50,
  packs_opened_today INT NOT NULL DEFAULT 0,
  last_pack_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  first_obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ,
  UNIQUE (user_id, sticker_id)
);

CREATE TABLE user_album_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  pasted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sticker_id)
);

CREATE TABLE pack_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type pack_type NOT NULL DEFAULT 'normal',
  sticker_ids UUID[] NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL DEFAULT 'department_page',
  department_slug TEXT,
  image_url TEXT,
  link_url TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfil al registrarse
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Abrir sobre normal (2/día, 2 cromos) — lógica en servidor
CREATE OR REPLACE FUNCTION public.open_normal_pack()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid()::uuid;
  today DATE := (timezone('America/Tegucigalpa', now()))::date;
  prof user_profiles%ROWTYPE;
  granted UUID[] := '{}';
  sid UUID;
  pool UUID[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO prof FROM user_profiles WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
  INSERT INTO user_profiles (user_id) VALUES (uid);
  SELECT * INTO prof FROM user_profiles WHERE user_id = uid FOR UPDATE;
  END IF;

  IF prof.last_pack_date IS DISTINCT FROM today THEN
    UPDATE user_profiles
    SET last_pack_date = today, packs_opened_today = 0, updated_at = now()
    WHERE user_id = uid;
    prof.packs_opened_today := 0;
    prof.last_pack_date := today;
  END IF;

  IF prof.packs_opened_today >= 2 THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  SELECT array_agg(id) INTO pool
  FROM (
    SELECT id FROM stickers
    WHERE is_mvp = true AND rarity = 'common'
    ORDER BY random()
    LIMIT 2
  ) picked;

  IF pool IS NULL OR array_length(pool, 1) < 2 THEN
    RAISE EXCEPTION 'no_stickers_configured';
  END IF;

  FOREACH sid IN ARRAY pool LOOP
    granted := array_append(granted, sid);
    INSERT INTO user_stickers (user_id, sticker_id, quantity)
    VALUES (uid, sid, 1)
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET quantity = user_stickers.quantity + 1;
  END LOOP;

  UPDATE user_profiles
  SET packs_opened_today = prof.packs_opened_today + 1, updated_at = now()
  WHERE user_id = uid;

  INSERT INTO pack_opens (user_id, pack_type, sticker_ids)
  VALUES (uid, 'normal', granted);

  RETURN jsonb_build_object(
    'sticker_ids', to_jsonb(granted),
    'packs_remaining_today', 2 - (prof.packs_opened_today + 1)
  );
END;
$$;

-- Pegar cromo en álbum
CREATE OR REPLACE FUNCTION public.paste_sticker(p_sticker_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid()::uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_stickers
    WHERE user_id = uid AND sticker_id = p_sticker_id AND quantity > 0
  ) THEN
    RAISE EXCEPTION 'sticker_not_owned';
  END IF;
  INSERT INTO user_album_slots (user_id, sticker_id)
  VALUES (uid, p_sticker_id)
  ON CONFLICT (user_id, sticker_id) DO NOTHING;
END;
$$;

-- RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_album_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_opens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_read" ON departments FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "stickers_read" ON stickers FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "profiles_read_own" ON user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid()::uuid);
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()::uuid);

CREATE POLICY "user_stickers_own" ON user_stickers FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY "album_slots_own" ON user_album_slots FOR ALL TO authenticated USING (user_id = auth.uid()::uuid) WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY "pack_opens_own" ON pack_opens FOR SELECT TO authenticated USING (user_id = auth.uid()::uuid);

CREATE POLICY "ads_read_active" ON ads FOR SELECT TO authenticated, anon
  USING (
    active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_to IS NULL OR valid_to >= now())
  );

GRANT EXECUTE ON FUNCTION public.open_normal_pack() TO authenticated;
GRANT EXECUTE ON FUNCTION public.paste_sticker(UUID) TO authenticated;

-- Seed: 18 departamentos
INSERT INTO departments (name, slug, page_order, slots_count, is_mvp_active, fact_title) VALUES
  ('Atlántida', 'atlantida', 1, 5, false, 'Costa caribeña'),
  ('Colón', 'colon', 2, 5, false, 'Puerto y cultura garífuna'),
  ('Comayagua', 'comayagua', 3, 5, false, 'Antigua capital'),
  ('Copán', 'copan', 4, 5, false, 'Ruinas mayas'),
  ('Cortés', 'cortes', 5, 5, true, 'Corazón industrial'),
  ('Choluteca', 'choluteca', 6, 5, false, 'Sur del país'),
  ('El Paraíso', 'el-paraiso', 7, 5, false, 'Tierra de montañas'),
  ('Francisco Morazán', 'francisco-morazan', 8, 5, true, 'Capital y valle'),
  ('Gracias a Dios', 'gracias-a-dios', 9, 5, false, 'La Mosquitia'),
  ('Intibucá', 'intibuca', 10, 5, false, 'Tierra lenca'),
  ('Islas de la Bahía', 'islas-de-la-bahia', 11, 5, false, 'Mar y arrecifes'),
  ('La Paz', 'la-paz', 12, 5, false, 'Valle fértil'),
  ('Lempira', 'lempira', 13, 5, false, 'Cacique Lempira'),
  ('Ocotepeque', 'ocotepeque', 14, 5, false, 'Frontera occidental'),
  ('Olancho', 'olancho', 15, 5, false, 'Tierra de ganado'),
  ('Santa Bárbara', 'santa-barbara', 16, 5, false, 'Cordillera norte'),
  ('Valle', 'valle', 17, 5, false, 'Sur compacto'),
  ('Yoro', 'yoro', 18, 5, false, 'Lluvia de peces');

-- Departamento especiales (2 cromos plata/especial MVP)
INSERT INTO departments (name, slug, page_order, slots_count, is_mvp_active, fact_title)
VALUES ('Edición especial', 'edicion-especial', 99, 2, true, 'Cromos plata y especial');

-- Cromos MVP: 5 Cortés, 5 Francisco Morazán, 2 especiales
INSERT INTO stickers (department_id, slot_index, number, name, fact_text, rarity, is_mvp)
SELECT d.id, g.slot, g.num, g.nm, g.fact, 'common'::sticker_rarity, true
FROM departments d
CROSS JOIN (VALUES
  (1, 1, 'San Pedro Sula', 'Principal ciudad del departamento'),
  (2, 2, 'Puerto Cortés', 'Puerto más importante del país'),
  (3, 3, 'Cuyamel', 'Historia bananera'),
  (4, 4, 'La Lima', 'Tradición cafetalera'),
  (5, 5, 'Choloma', 'Crecimiento industrial')
) AS g(slot, num, nm, fact)
WHERE d.slug = 'cortes';

INSERT INTO stickers (department_id, slot_index, number, name, fact_text, rarity, is_mvp)
SELECT d.id, g.slot, g.num, g.nm, g.fact, 'common'::sticker_rarity, true
FROM departments d
CROSS JOIN (VALUES
  (1, 6, 'Tegucigalpa', 'Capital de Honduras'),
  (2, 7, 'Comayagüela', 'Gemela de Tegucigalpa'),
  (3, 8, 'Valle de Ángeles', 'Pueblo turístico'),
  (4, 9, 'Santa Lucía', 'Vista al valle'),
  (5, 10, 'Lepaterique', 'Cultura colonial')
) AS g(slot, num, nm, fact)
WHERE d.slug = 'francisco-morazan';

INSERT INTO stickers (department_id, slot_index, number, name, fact_text, rarity, is_mvp)
SELECT d.id, g.slot, g.num, g.nm, g.fact, g.rar::sticker_rarity, true
FROM departments d
CROSS JOIN (VALUES
  (1, 11, 'Lempira legendario', 'Héroe nacional', 'silver'),
  (2, 12, 'Orgullo catracho', 'Edición especial MVP', 'special')
) AS g(slot, num, nm, fact, rar)
WHERE d.slug = 'edicion-especial';
