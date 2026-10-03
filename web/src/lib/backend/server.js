// Backends de SERVIDOR (usuario por cookies y service_role). Vive aparte de index.js porque
// importa cookies de Next y el cliente con la service_role: nada de esto puede entrar al bundle
// del navegador. index.js lo carga con import() dinamico solo en el servidor.
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { IS_LOCAL, SUPABASE_ANON_KEY, SUPABASE_URL, serverEnv } from '@/config';
import { cookiesDePeticion } from './cookies.js';
import { restringir } from './surface.js';

function exigirConfigPublica() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY (o define SUSAN_LOCAL=1 para el modo local).');
    }
}

/** Usuario de la peticion (cookies). RSC: el set de cookies puede fallar y se ignora. */
export async function crearBackendServidor() {
    if (IS_LOCAL) {
        const { crearBackendServidorLocal } = await import('@/lib/local/client-server.js');
        return crearBackendServidorLocal();
    }
    // Las cookies primero: marca la renderizacion como dinamica. Si faltara la configuracion en `next build`, el
    // prerender de una pagina no debe fallar por esto (la pagina depende de la peticion y no se prerenderiza).
    const almacen = await cookiesDePeticion();
    exigirConfigPublica();
    const cliente = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => almacen.getAll(),
            setAll(lista) {
                try {
                    for (const { name, value, options } of lista) almacen.set(name, value, options);
                } catch {
                    // Server Component: no se pueden escribir cookies; el proxy ya refresca la sesion.
                }
            },
        },
    });
    return restringir(cliente);
}

let admin = null;

/** service_role: salta RLS. Solo servidor; la llave nunca sale de aqui. */
export async function crearBackendAdmin() {
    if (IS_LOCAL) {
        const { crearBackendAdminLocal } = await import('@/lib/local/client-admin.js');
        return crearBackendAdminLocal();
    }
    const { supabaseServiceRoleKey } = serverEnv();
    if (!SUPABASE_URL || !supabaseServiceRoleKey) {
        throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el backend de administracion.');
    }
    if (!admin) {
        // Sin sesion persistida ni refresco: cada llamada va con la llave de servicio.
        admin = restringir(
            createClient(SUPABASE_URL, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
            { admin: true },
        );
    }
    return admin;
}
