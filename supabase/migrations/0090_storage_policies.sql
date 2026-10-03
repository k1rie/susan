-- 0090 · Bucket privado y politicas de Storage.
-- Solo se aplica si existe storage.objects (Supabase real, o los stubs locales): la migracion es
-- identica en ambos entornos y no falla en una base sin Storage.
--
-- Modelo (CLAUDE.md, RNF-04): el navegador NUNCA toca el bucket. Todo acceso (subir, firmar,
-- borrar) lo hacen los Route Handlers con service_role, que salta RLS, despues de autorizar por
-- RPC. Por eso no se crea ninguna politica permisiva para anon/authenticated; ademas se agrega
-- una politica RESTRICTIVE que cierra el bucket aunque en el futuro alguien cree por error una
-- politica permisiva demasiado amplia.

DO $$
BEGIN
    IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
        RAISE NOTICE 'storage no disponible: se omiten bucket y politicas';
        RETURN;
    END IF;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('susan-private', 'susan-private', false, 10485760,
            ARRAY['image/jpeg', 'image/png', 'application/pdf', 'application/json'])
    ON CONFLICT (id) DO UPDATE
        SET public = false,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;

    EXECUTE 'DROP POLICY IF EXISTS susan_private_solo_servicio ON storage.objects';
    EXECUTE $p$
        CREATE POLICY susan_private_solo_servicio ON storage.objects
            AS RESTRICTIVE FOR ALL TO anon, authenticated
            USING (bucket_id <> 'susan-private')
            WITH CHECK (bucket_id <> 'susan-private')
    $p$;
END
$$;
