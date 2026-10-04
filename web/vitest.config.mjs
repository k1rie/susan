import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pruebas unitarias: lógica pura (numerics, lib) en entorno node; componentes/hooks en jsdom
// (se activa por archivo con el comentario `// @vitest-environment jsdom`).
export default defineConfig({
    oxc: { jsx: { runtime: 'automatic' } },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.{js,jsx}'],
        setupFiles: ['./vitest.setup.js'],
        css: false,
        restoreMocks: true,
    },
});
