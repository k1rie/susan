'use client';

import dynamic from 'next/dynamic';

// La gráfica de series (recharts) se carga aparte para no engordar el JS inicial; mientras llega se reserva el espacio de la tarjeta.
// La implementación vive en GraficaSerieImpl.jsx (misma API de props).
const GraficaSerieImpl = dynamic(() => import('./GraficaSerieImpl.jsx'), {
    ssr: false,
    loading: () => <div aria-hidden="true" className="h-[26rem] rounded-xl border border-border bg-card" />,
});

export default function GraficaSerie(props) {
    return <GraficaSerieImpl {...props} />;
}
