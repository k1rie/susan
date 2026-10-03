-- 0990 · Recarga el esquema de PostgREST (Supabase) al terminar las migraciones.
-- Supabase ya recarga con un event trigger en cada DDL; este NOTIFY es un cinturon extra para que las
-- funciones api_* nuevas aparezcan de inmediato como /rest/v1/rpc/<nombre>. En PostgreSQL sin PostgREST no hace nada.
NOTIFY pgrst, 'reload schema';
