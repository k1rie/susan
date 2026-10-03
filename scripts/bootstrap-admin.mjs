#!/usr/bin/env node
// Crea el PRIMER administrador en un proyecto Supabase real: cuenta en Auth + fila en `usuario` (rol administrador).
// Es la única cuenta que no puede crear otra persona desde la app (después, el administrador crea las demás en /admin/usuarios).
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/bootstrap-admin.mjs --email admin@tu-dominio.mx [--password 'Clave-Larga-123']
//   Sin --password genera una contraseña aleatoria y la imprime UNA vez (guárdala y cámbiala en /cambiar-contrasena).
// Si algo falla después de crear la cuenta de Auth, la borra (no deja cuentas huérfanas). Requiere que las migraciones ya estén aplicadas.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'web', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = arg('--email');
if (!url || !key || !email) {
    console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-admin.mjs --email correo [--password clave]');
    process.exit(1);
}
const generada = !arg('--password');
const password = arg('--password') || randomBytes(15).toString('base64url');
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.error('La contraseña debe tener al menos 10 caracteres, una letra y un número.');
    process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existe } = await sb.from('usuario').select('id_usuario').eq('correo', email).maybeSingle();
if (existe) {
    console.error(`Ya existe un usuario con el correo ${email}.`);
    process.exit(1);
}

const { data: creado, error: eAuth } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rol: 'administrador' } });
if (eAuth) {
    console.error('No se pudo crear la cuenta de Auth:', eAuth.message);
    process.exit(1);
}
const { error: eFila } = await sb.from('usuario').insert({ auth_uid: creado.user.id, correo: email, rol: 'administrador' });
if (eFila) {
    await sb.auth.admin.deleteUser(creado.user.id);
    console.error('No se pudo crear la fila de usuario (se revirtió la cuenta de Auth):', eFila.message);
    process.exit(1);
}
console.log(`✓ Administrador creado: ${email}`);
if (generada) console.log(`  Contraseña temporal (se muestra una sola vez): ${password}`);
