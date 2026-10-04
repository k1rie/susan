import clsx from 'clsx';

// Muestra de una serie en la leyenda y el tooltip: la FORMA (punto, línea, discontinua, banda) además del color, porque ajuste,
// proyección e intervalo pueden compartir el azul de la gráfica y la señal no debe depender solo del color.
const FORMAS = {
    punto: 'size-2.5 rounded-full',
    linea: 'h-0.5 w-4 rounded-full',
    banda: 'h-2.5 w-4 rounded-[3px] opacity-30',
};

export default function MuestraForma({ forma = 'punto', color, className }) {
    if (forma === 'discontinua') {
        return <span aria-hidden="true" data-forma="discontinua" className={clsx('inline-block h-0 w-4 shrink-0 border-t-2 border-dashed', className)} style={{ borderColor: color }} />;
    }
    const conocida = Boolean(FORMAS[forma]);
    return <span aria-hidden="true" data-forma={conocida ? forma : 'punto'} className={clsx('inline-block shrink-0', conocida ? FORMAS[forma] : FORMAS.punto, className)} style={{ backgroundColor: color }} />;
}
