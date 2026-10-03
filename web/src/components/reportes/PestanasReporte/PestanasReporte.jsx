'use client';

import clsx from 'clsx';
import Tabs from '@/components/ui/Tabs';

// Pestañas del reporte (Resumen / detalle). Los paneles se montan SIEMPRE y el inactivo solo se oculta con CSS: así no se pierde
// el estado de la tabla ni de los datos. Al imprimir no se usa este contenido (el contenedor va con print:hidden): el papel sale
// de HojaImpresion, que ya trae TODAS las filas, así que el panel inactivo no necesita mostrarse en impresión.
// Cada panel es enfocable (tabIndex 0) para que un panel sin controles propios (solo gráficas) se alcance con teclado.
//   pestanas: [{ id, label, count? }] · paneles: { [id]: ReactNode }
export default function PestanasReporte({ pestanas, valor, onCambio, paneles, idPrefix = 'rep' }) {
    return (
        <div className="flex flex-col gap-4">
            <Tabs tabs={pestanas} value={valor} onChange={onCambio} idPrefix={idPrefix} />
            {pestanas.map((t) => (
                <div
                    key={t.id}
                    role="tabpanel"
                    id={`${idPrefix}-panel-${t.id}`}
                    aria-labelledby={`${idPrefix}-${t.id}`}
                    tabIndex={0}
                    className={clsx('flex-col gap-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 rounded-md', t.id === valor ? 'flex' : 'hidden')}
                >
                    {paneles[t.id]}
                </div>
            ))}
        </div>
    );
}
