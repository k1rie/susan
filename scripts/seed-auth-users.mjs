#!/usr/bin/env node
// Crea en Supabase Auth las cuentas de la tabla `usuario` (semilla de demostración) con el MISMO uuid (usuario.auth_uid),
// para que api_yo() las reconozca. SOLO para un proyecto Supabase real: en modo local las cuentas ya existen
// (supabase/seed/10_local_auth.sql). No se ejecuta nunca desde la aplicación.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-auth-users.mjs [--password 'Clave-Temporal-123']
//   Sin --password genera una contraseña aleatoria distinta por cuenta y la imprime UNA vez (guárdala en un gestor de contraseñas).
// Idempotente: las cuentas que ya existen se omiten. La cuenta de servicio (servicio@susan.local) NO tiene sesión y se omite.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'web', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
}
const i = process.argv.indexOf('--password');
const fija = i > -1 ? process.argv[i + 1] : null;
if (fija && fija.length < 10) {
    console.error('La contraseña debe tener al menos 10 caracteres.');
    process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: usuarios, error } = await sb.from('usuario').select('auth_uid, correo, rol, activo').order('id_usuario');
if (error) {
    console.error('No se pudo leer la tabla usuario:', error.message);
    process.exit(1);
}

let creadas = 0;
let omitidas = 0;
for (const u of usuarios) {
    if (u.correo === 'servicio@susan.local') continue;
    const password = fija || randomBytes(12).toString('base64url');
    const { error: e } = await sb.auth.admin.createUser({
        id: u.auth_uid,
        email: u.correo,
        password,
        email_confirm: true,
        user_metadata: { rol: u.rol },
    });
    if (e) {
        if (/already|registered|exists/i.test(e.message)) {
            omitidas += 1;
            continue;
        }
        console.error(`✗ ${u.correo}: ${e.message}`);
        continue;
    }
    creadas += 1;
    console.log(`✓ ${u.correo.padEnd(34)} ${u.rol.padEnd(14)} ${fija ? '(contraseña fija)' : password}`);
}
console.log(`\n${creadas} cuenta(s) creada(s), ${omitidas} ya existían.`);
