// Compila cada route.js con un import dinámico (detecta errores de sintaxis e imports rotos) y comprueba
// que exporta exactamente los métodos esperados como funciones.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ getServerBackend: vi.fn(), getAdminBackend: vi.fn() }));

const RUTAS = {
    'admin/camaras/[id]/probar': ['POST'],
    'admin/usuarios': ['POST'],
    'admin/usuarios/[id]/restablecer': ['POST'],
    'alumnos/[id]/plantilla': ['POST'],
    'casos/[id]/detecciones': ['GET'],
    'consentimientos': ['POST'],
    'consentimientos/[id]/revocar': ['POST'],
    'documentos/consentimiento/[id]': ['GET'],
    'documentos/plantilla/[id]': ['GET'],
    'documentos/plantilla_foto/[id]': ['GET'],
    'indice': ['GET'],
    'indice/reconstruir': ['POST'],
    'indice/revertir': ['POST'],
    'indice/sincronizar': ['POST'],
    'jobs/cerrar-sesiones': ['GET', 'POST'],
    'jobs/purgar-recortes': ['GET', 'POST'],
    'jobs/recalcular': ['GET', 'POST'],
    'jobs/reconstruir-indice': ['GET', 'POST'],
    'jobs/resolver-pendientes': ['GET', 'POST'],
    'justificantes/[id]/documento': ['GET'],
    'justificantes/documento': ['POST'],
    'plantilla/verificar': ['POST'],
    'salud': ['GET'],
    'sesiones/[id]/captura': ['POST'],
};

// Rutas de este dominio descubiertas en disco (excluye _local, que es de adapters).
const EN_DISCO = Object.keys(import.meta.glob('./**/route.js'))
    .map((r) => r.replace('./', '').replace('/route.js', ''))
    .filter((r) => !r.startsWith('_local') && !r.startsWith('%5Flocal'));

describe('Route Handlers de /api', () => {
    it('no hay rutas sin declarar ni declaradas sin archivo', () => {
        expect([...EN_DISCO].sort()).toEqual(Object.keys(RUTAS).sort());
    });

    it.each(Object.entries(RUTAS))('%s compila y exporta %j', async (ruta, metodos) => {
        const modulos = import.meta.glob('./**/route.js');
        const modulo = await modulos[`./${ruta}/route.js`]();
        const permitidos = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'maxDuration']);
        for (const m of metodos) expect(typeof modulo[m], `${ruta} ${m}`).toBe('function');
        // Ningún export extra que Next rechazaría en un route.js (solo métodos HTTP y configuración de segmento).
        for (const exportado of Object.keys(modulo)) expect(permitidos.has(exportado), `${ruta} exporta ${exportado}`).toBe(true);
    });
});
