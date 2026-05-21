-- Migración: Programa la finalización automática de subastas expiradas

-- Habilita pg_cron si no está instalado (necesario en la instancia Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'finalize_expired_auctions'
  ) THEN
    PERFORM cron.schedule(
      'finalize_expired_auctions',
      '*/5 * * * *',
      'SELECT public.finalize_expired_auctions();'
    );
  END IF;
END;
$$;
