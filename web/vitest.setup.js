import { afterEach, beforeEach } from 'vitest';

// Solo en pruebas jsdom: matchers de DOM y limpieza entre pruebas.
if (typeof document !== 'undefined') {
    await import('@testing-library/jest-dom/vitest');
    const { cleanup } = await import('@testing-library/react');
    afterEach(() => cleanup());
    // Los componentes cargados con next/dynamic (shim de pruebas) deben estar resueltos antes de renderizar.
    beforeEach(async () => {
        await Promise.all(globalThis.__dinamicosPendientes ?? []);
    });
}
