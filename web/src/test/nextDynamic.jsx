// Sustituto de `next/dynamic` SOLO para vitest (alias en vitest.config.js). En producción next/dynamic parte el JS en chunks y carga el
// componente de forma asíncrona; en las pruebas eso obligaría a esperar cada gráfica. Este shim empieza a cargar el módulo al definir el
// componente y registra la promesa en `globalThis.__dinamicosPendientes`; vitest.setup.js la espera antes de cada prueba, de modo que el
// primer render ya es síncrono y con el componente real.
export default function dynamic(cargador, opciones = {}) {
    let Resuelto = null;
    const promesa = Promise.resolve(cargador()).then((m) => {
        Resuelto = m.default ?? m;
    });
    (globalThis.__dinamicosPendientes ??= []).push(promesa);
    return function Dinamico(props) {
        if (Resuelto) return <Resuelto {...props} />;
        const Carga = opciones.loading;
        return Carga ? <Carga isLoading pastDelay error={null} /> : null;
    };
}
