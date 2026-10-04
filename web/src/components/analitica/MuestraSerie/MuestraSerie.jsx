import clsx from 'clsx';

// Muestra de una serie en el tooltip de las gráficas de línea. Ajuste, proyección e intervalo comparten el azul de la gráfica, así que
// la forma (línea, discontinua, banda, punto) es lo que las distingue: la señal no depende solo del color. Mismas medidas que las
// muestras de la leyenda de GraficaLinea, para que leyenda y tooltip se vean como una sola cosa.
const FORMAS = {
    punto: 'size-2.5 rounded-full',
    linea: 'h-0.5 w-4 rounded-full',
    banda: 'h-2.5 w-4 rounded-[3px] opacity-30',
};

export default function MuestraSerie({ forma = 'punto', color, className }) {
    if (forma === 'discontinua') {
        return (
            <span
                aria-hidden="true"
                data-forma={forma}
                className={clsx('inline-block h-0 w-4 shrink-0 border-t-2 border-dashed', className)}
                style={{ borderColor: color }}
            />
        );
    }
    return (
        <span
            aria-hidden="true"
            data-forma={FORMAS[forma] ? forma : 'punto'}
            className={clsx('inline-block shrink-0', FORMAS[forma] || FORMAS.punto, className)}
            style={{ backgroundColor: color }}
        />
    );
}
