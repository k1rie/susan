// Autenticacion del modo local sobre auth.users (stub de Supabase Auth). Contrasenas con
// bcrypt de pgcrypto: extensions.crypt(clave, hash) / extensions.gen_salt('bf'), igual que GoTrue.
// Los errores imitan los de supabase-js (name, message, status, code) para que la capa de datos
// los trate igual en modo real y local.
import { obtenerPool } from './pool.js';
import { esUuid } from './session.js';

export function errorAuth(code, message, status = 400, name = 'AuthApiError') {
    return { name, message, status, code };
}

export const errorSinSesion = () => errorAuth(undefined, 'Auth session missing!', 400, 'AuthSessionMissingError');

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Politica de contrasena (espejo de la pantalla de cambio): >= 10 caracteres, una letra y un digito. */
export function contrasenaValida(clave) {
    return typeof clave === 'string' && clave.length >= 10 && /[A-Za-z]/.test(clave) && /\d/.test(clave);
}

const COLUMNAS = `id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at`;

/** Forma `User` de supabase-js a partir de una fila de auth.users. Nunca incluye el hash. */
function aUsuario(fila) {
    if (!fila) return null;
    return {
        id: fila.id,
        aud: fila.aud || 'authenticated',
        role: fila.role || 'authenticated',
        email: fila.email,
        email_confirmed_at: fila.email_confirmed_at ? new Date(fila.email_confirmed_at).toISOString() : null,
        app_metadata: fila.raw_app_meta_data || {},
        user_metadata: fila.raw_user_meta_data || {},
        created_at: fila.created_at ? new Date(fila.created_at).toISOString() : null,
        updated_at: fila.updated_at ? new Date(fila.updated_at).toISOString() : null,
    };
}

export async function obtenerUsuarioPorId(id) {
    if (!esUuid(id)) return null;
    const { rows } = await obtenerPool().query(`SELECT ${COLUMNAS} FROM auth.users WHERE id = $1`, [id]);
    return aUsuario(rows[0]);
}

/**
 * Verifica correo + contrasena. Devuelve { user } o { error }. Mismo mensaje para correo
 * inexistente y clave mala (no revela cuentas), como GoTrue.
 */
export async function verificarCredenciales(correo, clave) {
    const invalido = { error: errorAuth('invalid_credentials', 'Invalid login credentials', 400) };
    if (typeof correo !== 'string' || typeof clave !== 'string' || !correo || !clave || clave.length > 200) {
        return invalido;
    }
    try {
        const { rows } = await obtenerPool().query(
            `SELECT ${COLUMNAS},
                    (encrypted_password IS NOT NULL
                     AND encrypted_password = extensions.crypt($2, encrypted_password)) AS clave_ok
               FROM auth.users WHERE lower(email) = lower($1)`,
            [correo.trim(), clave],
        );
        if (!rows[0] || !rows[0].clave_ok) return invalido;
        return { user: aUsuario(rows[0]) };
    } catch (e) {
        return { error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
    }
}

/** Cambia la contrasena de `id`. `exigirDistinta` rechaza repetir la actual (same_password de GoTrue). */
export async function cambiarContrasena(id, nueva, { exigirDistinta = true } = {}) {
    if (!contrasenaValida(nueva)) {
        return {
            error: errorAuth('weak_password', 'La contrasena no cumple los requisitos de seguridad.', 422, 'AuthWeakPasswordError'),
        };
    }
    try {
        const { rows } = await obtenerPool().query(
            `SELECT (encrypted_password = extensions.crypt($2, encrypted_password)) AS igual
               FROM auth.users WHERE id = $1`,
            [id, nueva],
        );
        if (!rows[0]) return { error: errorAuth('user_not_found', 'User not found', 404) };
        if (exigirDistinta && rows[0].igual) {
            return { error: errorAuth('same_password', 'New password should be different from the old password.', 422) };
        }
        await obtenerPool().query(
            `UPDATE auth.users
                SET encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now()
              WHERE id = $1`,
            [id, nueva],
        );
        return { user: await obtenerUsuarioPorId(id) };
    } catch (e) {
        return { error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
    }
}

/** En local no hay correo: se deja un aviso de desarrollo (sin el correo ni ningun enlace) y se responde ok. */
export function solicitarRecuperacion() {
    console.warn('[local] resetPasswordForEmail: modo local, no se envia correo. Usa admin.updateUserById o la pantalla de cambio de contrasena.');
    return { data: {}, error: null };
}

/** Sesion "supabase-like" de un usuario. El token real vive solo en la cookie httpOnly. */
export function aSesion(user, exp) {
    const ahora = Math.floor(Date.now() / 1000);
    return {
        access_token: 'local-session',
        refresh_token: 'local-session',
        token_type: 'bearer',
        expires_at: exp,
        expires_in: Math.max(0, exp - ahora),
        user,
    };
}

// ---- auth.admin ------------------------------------------------------------------------------
function esObjetoPlano(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function crearAdminAuth() {
    return {
        async createUser(attrs = {}) {
            const { email, password, user_metadata: um, app_metadata: am } = attrs;
            if (typeof email !== 'string' || !RE_CORREO.test(email)) {
                return { data: { user: null }, error: errorAuth('validation_failed', 'Correo invalido', 422) };
            }
            if (!contrasenaValida(password)) {
                return {
                    data: { user: null },
                    error: errorAuth('weak_password', 'La contrasena no cumple los requisitos de seguridad.', 422, 'AuthWeakPasswordError'),
                };
            }
            try {
                const { rows } = await obtenerPool().query(
                    `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
                     VALUES (lower($1), extensions.crypt($2, extensions.gen_salt('bf')), now(), $3::jsonb, $4::jsonb)
                     RETURNING ${COLUMNAS}`,
                    [
                        email.trim(),
                        password,
                        JSON.stringify(esObjetoPlano(am) ? am : { provider: 'email', providers: ['email'] }),
                        JSON.stringify(esObjetoPlano(um) ? um : {}),
                    ],
                );
                return { data: { user: aUsuario(rows[0]) }, error: null };
            } catch (e) {
                if (e.code === '23505') {
                    return { data: { user: null }, error: errorAuth('email_exists', 'A user with this email address has already been registered', 422) };
                }
                return { data: { user: null }, error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
            }
        },

        async updateUserById(id, attrs = {}) {
            if (!esUuid(id)) return { data: { user: null }, error: errorAuth('user_not_found', 'User not found', 404) };
            const sets = [];
            const valores = [id];
            const poner = (sql, valor) => {
                valores.push(valor);
                sets.push(sql.replace('?', `$${valores.length}`));
            };
            if (attrs.email !== undefined) {
                if (typeof attrs.email !== 'string' || !RE_CORREO.test(attrs.email)) {
                    return { data: { user: null }, error: errorAuth('validation_failed', 'Correo invalido', 422) };
                }
                poner('email = lower(?)', attrs.email.trim());
            }
            if (attrs.password !== undefined) {
                if (!contrasenaValida(attrs.password)) {
                    return {
                        data: { user: null },
                        error: errorAuth('weak_password', 'La contrasena no cumple los requisitos de seguridad.', 422, 'AuthWeakPasswordError'),
                    };
                }
                poner("encrypted_password = extensions.crypt(?, extensions.gen_salt('bf'))", attrs.password);
            }
            if (esObjetoPlano(attrs.user_metadata)) poner('raw_user_meta_data = ?::jsonb', JSON.stringify(attrs.user_metadata));
            if (esObjetoPlano(attrs.app_metadata)) poner('raw_app_meta_data = ?::jsonb', JSON.stringify(attrs.app_metadata));
            if (attrs.email_confirm === true) sets.push('email_confirmed_at = coalesce(email_confirmed_at, now())');
            try {
                sets.push('updated_at = now()');
                const { rows } = await obtenerPool().query(
                    `UPDATE auth.users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNAS}`,
                    valores,
                );
                if (!rows[0]) return { data: { user: null }, error: errorAuth('user_not_found', 'User not found', 404) };
                return { data: { user: aUsuario(rows[0]) }, error: null };
            } catch (e) {
                if (e.code === '23505') {
                    return { data: { user: null }, error: errorAuth('email_exists', 'A user with this email address has already been registered', 422) };
                }
                return { data: { user: null }, error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
            }
        },

        async deleteUser(id) {
            if (!esUuid(id)) return { data: { user: null }, error: errorAuth('user_not_found', 'User not found', 404) };
            try {
                const { rows } = await obtenerPool().query(`DELETE FROM auth.users WHERE id = $1 RETURNING ${COLUMNAS}`, [id]);
                if (!rows[0]) return { data: { user: null }, error: errorAuth('user_not_found', 'User not found', 404) };
                return { data: { user: aUsuario(rows[0]) }, error: null };
            } catch (e) {
                return { data: { user: null }, error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
            }
        },

        async listUsers({ page = 1, perPage = 50 } = {}) {
            const pagina = Math.max(1, Number.parseInt(page, 10) || 1);
            const porPagina = Math.min(1000, Math.max(1, Number.parseInt(perPage, 10) || 50));
            try {
                const total = (await obtenerPool().query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n;
                const { rows } = await obtenerPool().query(
                    `SELECT ${COLUMNAS} FROM auth.users ORDER BY created_at, id LIMIT $1 OFFSET $2`,
                    [porPagina, (pagina - 1) * porPagina],
                );
                const ultima = Math.max(1, Math.ceil(total / porPagina));
                return {
                    data: {
                        users: rows.map(aUsuario),
                        aud: 'authenticated',
                        total,
                        nextPage: pagina < ultima ? pagina + 1 : null,
                        lastPage: ultima,
                    },
                    error: null,
                };
            } catch (e) {
                return { data: { users: [] }, error: errorAuth('unexpected_failure', `Error de base de datos: ${e.code || e.message}`, 500) };
            }
        },
    };
}
