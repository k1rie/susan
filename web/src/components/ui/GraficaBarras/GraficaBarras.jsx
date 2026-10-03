'use client';

import dynamic from 'next/dynamic';

// Igual que GraficaDona: recharts se carga aparte y el contenedor reserva el alto (`alto`, 260 por defecto). La implementación vive en
// GraficaBarrasImpl.jsx (misma API de props).
const GraficaBarrasImpl = dynamic(() => import('./GraficaBarrasImpl.jsx'), { ssr: false });

export default function GraficaBarras(props) {
    return (
        <div style={{ minHeight: props.alto ?? 260 }}>
            <GraficaBarrasImpl {...props} />
        </div>
    );
}
