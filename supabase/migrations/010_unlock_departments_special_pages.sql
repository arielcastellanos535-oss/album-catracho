-- Migración 010: desbloqueo de departamentos por municipios y páginas especiales

ALTER TABLE IF EXISTS public.departments
  ADD COLUMN IF NOT EXISTS municipalities_count INT NOT NULL DEFAULT 0;

UPDATE public.departments
SET municipalities_count = slots_count
WHERE municipalities_count = 0;

UPDATE public.departments
SET slots_count = 10,
    municipalities_count = 10,
    fact_title = 'Edición especial · 7 plata + 3 oro'
WHERE slug = 'edicion-especial';

INSERT INTO public.departments (name, slug, page_order, slots_count, municipalities_count, is_mvp_active, fact_title)
SELECT 'Heroes', 'heroes', 100, 10, 10, true, '10 cupos de cromos Oro'
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments WHERE slug = 'heroes'
);

INSERT INTO public.departments (name, slug, page_order, slots_count, municipalities_count, is_mvp_active, fact_title)
SELECT 'Salón de la fama', 'salon-de-la-fama', 101, 10, 10, true, 'Guerra de municipios · 9 plata + 1 oro'
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments WHERE slug = 'salon-de-la-fama'
);
