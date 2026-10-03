// GET /auth/confirm?token_hash=...&type=recovery|invite — destino de los enlaces de los correos de Supabase.
// Canjea el token_hash por una sesion EN EL SERVIDOR (verifyOtp) y redirige a una pagina fija. Funciona aunque el
// usuario abra el correo en otro navegador o dispositivo (el flujo PKCE por defecto de @supabase/ssr solo funciona en el
// mismo navegador que pidio el correo). Plantilla de correo (docs/SUPABASE_SETUP.md):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
// Sin parametro `next`: los destinos son fijos, asi que no hay redireccion abierta.
import { NextResponse } from 'next/server';
import { getServerBackend } from '@/lib/backend';
import { IS_LOCAL } from '@/config';

const DESTINOS = Object.freeze({
    recovery: '/cambiar-contrasena',
    invite: '/activar-cuenta',
    magiclink: '/',
    email: '/',
    signup: '/',
    email_change: '/',
});

export async function GET(request) {
    // El modo local no tiene correos ni tokens: la ruta no existe alli.
    if (IS_LOCAL) return new NextResponse(null, { status: 404 });
    const { searchParams } = request.nextUrl;
    const tokenHash = searchParams.get('token_hash');
    const tipo = searchParams.get('type');
    const ir = (ruta) => NextResponse.redirect(new URL(ruta, request.url));
    if (!tokenHash || !Object.hasOwn(DESTINOS, tipo ?? '') || tokenHash.length > 512) return ir('/login?error=enlace_invalido');
    const backend = await getServerBackend();
    const { error } = await backend.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (error) return ir(tipo === 'recovery' ? '/recuperar?error=enlace_vencido' : '/login?error=enlace_vencido');
    return ir(DESTINOS[tipo]);
}
