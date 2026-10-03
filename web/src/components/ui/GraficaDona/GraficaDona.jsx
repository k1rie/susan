'use client';

import dynamic from 'next/dynamic';

// recharts pesa ~130 KB gzip: la gráfica se carga aparte (code-splitting) para no engordar el JS inicial de cada pantalla. El contenedor
// reserva el alto (`alto`, 240 por defecto) mientras llega, así que no hay salto de diseño. En pruebas, `next/dynamic` se sustituye por
// un shim síncrono (src/test/nextDynamic.jsx). La implementación vive en GraficaDonaImpl.jsx (misma API de props).
const GraficaDonaImpl = dynamic(() => import('./GraficaDonaImpl.jsx'), { ssr: false });

export default function GraficaDona(props) {
    return (
        <div style={{ minHeight: props.alto ?? 240 }}>
            <GraficaDonaImpl {...props} />
        </div>
    );
}
