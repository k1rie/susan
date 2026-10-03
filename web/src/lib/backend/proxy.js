// Refresco de sesion para src/proxy.js. Contrato: actualizarSesion(request) ->
// { response, user: { id } | null }. `response` siempre es NextResponse.next({ request }) con las
// cookies refrescadas ya escritas. NO consulta la base ni valida roles (redireccion optimista).
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { IS_LOCAL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { COOKIE_SESION, verificarTokenSesion } from '@/lib/local/session.js';

export async function actualizarSesion(request) {
    if (IS_LOCAL) {
        // Modo local: basta verificar la firma HMAC y la expiracion de la cookie.
        const sesion = verificarTokenSesion(request.cookies.get(COOKIE_SESION)?.value);
        return { response: NextResponse.next({ request }), user: sesion ? { id: sesion.sub } : null };
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    let response = NextResponse.next({ request });
    const cliente = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll(lista, cabeceras) {
                // Los tokens nuevos deben verlos tanto el resto de la cadena (request) como el navegador (response).
                for (const { name, value } of lista) request.cookies.set(name, value);
                response = NextResponse.next({ request });
                for (const { name, value, options } of lista) response.cookies.set(name, value, options);
                // Evita que una CDN cachee una respuesta con Set-Cookie de otro usuario.
                for (const [k, v] of Object.entries(cabeceras || {})) response.headers.set(k, v);
            },
        },
    });
    // getUser() valida el JWT contra Auth (getSession() solo lo lee de la cookie y no es confiable).
    const { data } = await cliente.auth.getUser();
    return { response, user: data?.user ? { id: data.user.id } : null };
}
