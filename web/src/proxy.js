// Proxy de Next 16 (antes "middleware"): refresca la sesion y hace el redireccionamiento
// OPTIMISTA a /login. No comprueba roles: la autorizacion real esta en RLS/RPC y en los handlers.
import { NextRequest, NextResponse } from 'next/server';
import { actualizarSesion } from '@/lib/backend/proxy.js';

// /cambiar-contrasena NO se protege aqui a proposito: en el flujo real de recuperacion de Supabase el token llega en el
// hash de la URL (solo lo ve el navegador), asi que la sesion de recuperacion se establece en el cliente y es la propia
// pagina la que comprueba si hay sesion.
const PREFIJOS_PROTEGIDOS = ['/docente', '/alumno', '/admin', '/tecnico', '/reportes', '/analitica'];

const esProtegida = (ruta) => PREFIJOS_PROTEGIDOS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

export async function proxy(entrante) {
    const { pathname, search } = entrante.nextUrl;
    // Reenvia la ruta pedida a los layouts (requerirSesion la usa para conservar ?next=). Siempre se SOBRESCRIBE: un
    // cliente no puede fijar x-pathname por su cuenta.
    const headers = new Headers(entrante.headers);
    headers.set('x-pathname', pathname + search);
    const request = new NextRequest(entrante, { headers });
    const { response, user } = await actualizarSesion(request);
    // Las /api/* nunca se redirigen: devuelven su propio 401 JSON. Solo se protegen paginas.
    if (!user && esProtegida(pathname) && !pathname.startsWith('/api/')) {
        const destino = new URL('/login', request.url);
        destino.searchParams.set('next', pathname + search);
        const redireccion = NextResponse.redirect(destino);
        // Conserva cookies refrescadas (p. ej. Supabase borra las vencidas).
        for (const c of response.cookies.getAll()) redireccion.cookies.set(c);
        return redireccion;
    }
    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|brand/|favicon\\.ico|api/jobs|api/_local|api/salud|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map|txt)$).*)',
    ],
};
