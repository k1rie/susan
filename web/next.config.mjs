// Cabeceras de seguridad (hallazgo de la revision): anti-clickjacking, nosniff, referrer, permisos y, en produccion,
// CSP + HSTS. La CSP se activa solo en produccion porque el modo de desarrollo de Next usa eval y websockets (HMR).
const isProd = process.env.NODE_ENV === 'production';

const origen = (url) => {
    try {
        return url ? new URL(url).origin : '';
    } catch {
        return '';
    }
};
const supabase = origen(process.env.NEXT_PUBLIC_SUPABASE_URL);

const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    // Recortes/fotos/documentos se sirven por URL firmada de Supabase Storage (img-src) y el navegador habla con Auth (connect-src).
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ''}`,
    "media-src 'self' blob:", // vista previa de la camara (getUserMedia)
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Next inyecta scripts en linea (hidratacion). Endurecerlo con nonces desde proxy.js es una mejora futura documentada.
    "script-src 'self' 'unsafe-inline'",
    `connect-src 'self'${supabase ? ` ${supabase}` : ''}`,
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
].join('; ');

const cabeceras = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // La camara solo para este origen (reconocimiento en el aula); sin microfono ni geolocalizacion.
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
    ...(isProd
        ? [
              { key: 'Content-Security-Policy', value: csp },
              { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          ]
        : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,
    poweredByHeader: false,

    // Cada dev-server paralelo puede usar su propio directorio de build (NEXT_DIST_DIR=.next-xyz.nosync).
    distDir: process.env.NEXT_DIST_DIR || '.next',

    // `pg` solo se usa en el adaptador local (src/lib/local) y en scripts: nunca en el bundle.
    serverExternalPackages: ['pg'],

    // Quita console.* en producción (conserva warn/error), como en MVP-FITNESS.
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },

    experimental: {
        optimizePackageImports: ['lucide-react'],
    },

    async headers() {
        return [{ source: '/(.*)', headers: cabeceras }];
    },
};

export default nextConfig;
