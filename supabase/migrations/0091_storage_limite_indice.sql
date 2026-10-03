-- 0091 · Tope del bucket para el JSON del índice FAISS.
-- Un índice de ~500 plantillas pesa ~1.4 MB, pero el diseño prevé hasta 20 000 (RNF-09): unos 55 MB en JSON con los
-- vectores en base64. Se sube el tope del bucket a 50 MiB (límite del plan gratuito de Supabase; en planes de pago
-- se puede subir también el límite global del proyecto). Documentos y fotos siguen validados a 5/10 MiB en el servidor.
DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NULL THEN
        RAISE NOTICE 'storage no disponible: se omite el ajuste del bucket';
        RETURN;
    END IF;
    UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'susan-private';
END
$$;
