// Pool de PostgreSQL del modo local. Singleton en globalThis: el hot reload de `next dev`
// re-evalua los modulos y, sin esto, abriria un pool nuevo (y 10 conexiones) en cada edicion.
import pg from 'pg';
import { serverEnv } from '@/config';

const CLAVE = Symbol.for('susan.local.pool');

export function obtenerPool() {
    if (!globalThis[CLAVE]) {
        const pool = new pg.Pool({
            connectionString: serverEnv().localDatabaseUrl,
            max: 10,
            idleTimeoutMillis: 30_000,
        });
        // Un cliente ocioso que pierde la conexion emite 'error'; sin manejador tumbaria el proceso.
        pool.on('error', (err) => console.error('[local] error en el pool de PostgreSQL:', err.message));
        globalThis[CLAVE] = pool;
    }
    return globalThis[CLAVE];
}

export async function cerrarPool() {
    const pool = globalThis[CLAVE];
    if (!pool) return;
    delete globalThis[CLAVE];
    await pool.end();
}
