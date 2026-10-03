'use client';

import dynamic from 'next/dynamic';

// Igual que GraficaSerie: carga diferida de recharts con el espacio reservado. La implementación vive en GraficaAcumuladoImpl.jsx.
const GraficaAcumuladoImpl = dynamic(() => import('./GraficaAcumuladoImpl.jsx'), {
    ssr: false,
    loading: () => <div aria-hidden="true" className="h-[26rem] rounded-xl border border-border bg-card" />,
});

export default function GraficaAcumulado(props) {
    return <GraficaAcumuladoImpl {...props} />;
}
