-- 0136 · Dirección de una cámara IP para el Route Handler de captura (solo service_role).
-- El docente nunca ve direccion_ip (api_camaras_listar la oculta a quien no es administrador); el servidor
-- la necesita para pedirle el fotograma al servicio de reconocimiento (camera_url). Se valida que la cámara
-- pertenezca al aula del grupo de la sesión (RN-06) para no revelar direcciones de otras aulas.
CREATE OR REPLACE FUNCTION public.svc_camara_direccion(p_id_sesion integer, p_id_camara integer) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_ip text;
BEGIN
    SELECT c.direccion_ip INTO v_ip
      FROM public.camara c
      JOIN public.grupo g ON g.id_aula = c.id_aula
      JOIN public.sesion_clase s ON s.id_grupo = g.id_grupo
     WHERE s.id_sesion = p_id_sesion
       AND c.id_camara = p_id_camara
       AND c.tipo = 'ip';
    IF NOT FOUND THEN
        PERFORM app.fallar('CAMARA_FUERA_DE_AULA', 'La cámara IP no existe o no pertenece al aula del grupo de la sesión (RN-06).');
    END IF;
    RETURN v_ip;
END
$$;
COMMENT ON FUNCTION public.svc_camara_direccion(integer, integer) IS $c$
Dirección (direccion_ip) de una cámara de tipo 'ip' del aula del grupo de la sesión; la usa el Route Handler de captura para armar camera_url.
ARGS: p_id_sesion integer; p_id_camara integer.
RETURNS: text (la dirección IP o nombre de host).
ERRORES: CAMARA_FUERA_DE_AULA (cámara inexistente, de otra aula o de tipo navegador)
ROLES: service_role
$c$;
REVOKE ALL ON FUNCTION public.svc_camara_direccion(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.svc_camara_direccion(integer, integer) TO service_role;
