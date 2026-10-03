// Configuración pública y de servidor de SUSAN. Un solo lugar para leer variables de entorno
// (patrón de MVP-FITNESS/src/config.js). NUNCA importar los valores de servidor desde un
// componente cliente: Next solo expone al navegador las variables NEXT_PUBLIC_*.

/** Modo local: PostgreSQL directo + disco, sin Supabase (desarrollo y pruebas sin Docker). */
export const IS_LOCAL = process.env.SUSAN_LOCAL === '1' || process.env.NEXT_PUBLIC_SUSAN_LOCAL === '1';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Bucket privado único (prefijos: registro/, consentimientos/, justificantes/, recortes/, indice/). */
export const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'susan-private';

/** Zona horaria institucional (Chiapas, sin horario de verano). */
export const TIMEZONE = 'America/Mexico_City';

// ---- Solo servidor (route handlers, scripts). No existen en el navegador. ----
export const serverEnv = () => ({
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    recognitionUrl: (process.env.RECOGNITION_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
    recognitionApiKey: process.env.RECOGNITION_SERVICE_API_KEY || '',
    cronSecret: process.env.CRON_SECRET || '',
    localDatabaseUrl: process.env.LOCAL_DATABASE_URL || 'postgres://localhost:54329/susan',
    localStorageDir: process.env.LOCAL_STORAGE_DIR || (process.env.SUSAN_LOCAL_DIR ? `${process.env.SUSAN_LOCAL_DIR}/storage` : '.local/storage'),
    localAuthSecret: process.env.LOCAL_AUTH_SECRET || 'susan-local-dev-secret-change-me',
});
