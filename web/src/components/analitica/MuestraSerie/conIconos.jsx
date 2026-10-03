import MuestraSerie from './MuestraSerie.jsx';

// ChartLegendContent pinta `config[clave].icon` en lugar del cuadrito de color. Cada (forma, color) tiene un componente de
// identidad estable (si fuera una función nueva por render, React desmontaría la leyenda en cada actualización).
const iconos = new Map();

function iconoDe(forma, color) {
    const clave = `${forma}|${color}`;
    if (!iconos.has(clave)) {
        const Icono = () => <MuestraSerie forma={forma} color={color} />;
        Icono.displayName = `MuestraSerie(${clave})`;
        iconos.set(clave, Icono);
    }
    return iconos.get(clave);
}

/** Copia de la configuración de un ChartContainer en la que cada serie con `forma` recibe su `icon` para la leyenda. */
export function conIconos(config) {
    return Object.fromEntries(Object.entries(config).map(([clave, c]) => [clave, c.forma ? { ...c, icon: iconoDe(c.forma, c.color) } : c]));
}
