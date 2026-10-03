/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,

    // Cada dev-server paralelo puede usar su propio directorio de build (NEXT_DIST_DIR=.next-xyz).
    distDir: process.env.NEXT_DIST_DIR || '.next',

    // `pg` solo se usa en el adaptador local (src/lib/local) y en scripts: nunca en el bundle.
    serverExternalPackages: ['pg'],

    // Quita console.* en producción (conserva warn/error), como en MVP-FITNESS.
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },

    experimental: {
        optimizePackageImports: ['lucide-react', 'recharts'],
    },
};

export default nextConfig;
