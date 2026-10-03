// Apoyo de las pruebas que usan la BD local (postgres://127.0.0.1:54329/susan): si no responde,
// esas suites se omiten con describe.skipIf en vez de fallar.
import pg from 'pg';

export const URL_BD_PRUEBAS = process.env.LOCAL_DATABASE_URL || 'postgres://127.0.0.1:54329/susan';

export async function bdDisponible() {
    const c = new pg.Client({ connectionString: URL_BD_PRUEBAS, connectionTimeoutMillis: 1500 });
    try {
        await c.connect();
        await c.query('SELECT 1 FROM auth.users LIMIT 1');
        return true;
    } catch {
        return false;
    } finally {
        await c.end().catch(() => {});
    }
}

export async function idDeUsuario(email) {
    const c = new pg.Client({ connectionString: URL_BD_PRUEBAS });
    await c.connect();
    try {
        const { rows } = await c.query('SELECT id FROM auth.users WHERE email = $1', [email]);
        return rows[0]?.id ?? null;
    } finally {
        await c.end();
    }
}
