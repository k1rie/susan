'use client';

import { Suspense, lazy, useEffect } from 'react';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/layout/PageHeader';
import { useApiQuery } from '@/hooks/data/useApiQuery.js';
import { ahora } from '@/lib/api/plataforma.js';
import { docentePanel } from '@/lib/api/sesiones.js';

// Cada cuánto se vuelve a leer el panel y el reloj del plantel: la tarjeta «Pasar lista» cambia sola cuando llega la hora de la
// clase (el botón deshabilitado «Disponible a las 07:00» se activa sin recargar). Se pausa con la pestaña oculta (useApiQuery).
const REFRESCO_MS = 30_000;

// El contenido (tarjetas, listas y gráficas) solo se pinta cuando llegan los datos, que se piden en el cliente: hasta entonces se
// ve el mismo indicador de carga. Por eso se carga en diferido y fuera del JS inicial de /docente (presupuesto, docs/DECISIONS.md);
// la descarga empieza al montar, en paralelo con la consulta, y mientras termina se sigue viendo el mismo indicador.
const cargarContenido = () => import('./ContenidoPanel.jsx');
const ContenidoPanel = lazy(cargarContenido);
const cargando = (
    <div className="flex justify-center py-10">
        <Spinner />
    </div>
);

// P-02: panel del docente. `encabezado={false}` lo omite cuando la portada (HomeRol) ya aporta el h1.
export default function PanelDocente({ encabezado = true }) {
    const panel = useApiQuery(docentePanel, {}, { refetchInterval: REFRESCO_MS });
    const reloj = useApiQuery(ahora, {}, { refetchInterval: REFRESCO_MS });
    const simulado = reloj.data?.reloj_simulado ? reloj.data : null;

    // Si falla (sin red), React.lazy vuelve a pedirlo al pintar el contenido.
    useEffect(() => {
        cargarContenido().catch(() => {});
    }, []);

    return (
        <div>
            {encabezado ? (
                <PageHeader
                    title="Panel del docente"
                    subtitle={panel.data?.fecha ? `Hoy: ${panel.data.fecha}` : undefined}
                    actions={
                        <>
                            <Button variant="secondary" href="/reportes">
                                Reportes
                            </Button>
                            <Button variant="secondary" href="/analitica">
                                Analítica
                            </Button>
                        </>
                    }
                />
            ) : (
                panel.data?.fecha && <p className="mb-3 text-sm text-muted-foreground">Hoy: {panel.data.fecha}</p>
            )}
            {simulado && (
                <p className="mb-3 text-xs text-muted-foreground" role="note">
                    Reloj simulado: {simulado.fecha} {simulado.hora}
                </p>
            )}
            <DataState
                loading={panel.loading}
                error={panel.error}
                data={panel.data}
                onRetry={panel.refetch}
                isEmpty={() => false}
                loadingFallback={cargando}
            >
                {(d) => (
                    <Suspense fallback={cargando}>
                        <ContenidoPanel datos={d} hora={reloj.data?.hora} />
                    </Suspense>
                )}
            </DataState>
        </div>
    );
}
