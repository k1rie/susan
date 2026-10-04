'use client';

import { useEffect, useState } from 'react';
import BarraSegmentada from '@/components/ui/BarraSegmentada';
import { resumenTexto } from '@/lib/graficas.js';
import { CONFIG_SESION_ABIERTA, distribucionSesionAbierta, textoHace } from '../MonitorSesion/monitorSesion.utils.js';

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// «· hace 8 s»: se actualiza solo cada segundo en este componente aparte, para que el panel no se vuelva a renderizar por un reloj.
// Antes del primer tic no pinta nada (la hora no puede leerse durante el render).
function TiempoRelativo({ desde }) {
    const [ahora, setAhora] = useState(null);
    useEffect(() => {
        const tic = () => setAhora(Date.now());
        const inicio = setTimeout(tic, 0);
        const intervalo = setInterval(tic, 1000);
        return () => {
            clearTimeout(inicio);
            clearInterval(intervalo);
        };
    }, [desde]);
    if (ahora == null || !Number.isFinite(desde)) return null;
    return <> · {textoHace((ahora - desde) / 1000)}</>;
}

// Cifra del pase de lista: «N de M presentes» grande, barra fina con presentes/retardos/sin registro y la última captura.
//   totales = de api_sesion_monitor · ultima = respuesta de la última captura enviada ({ rostros, validas, cambios, recibida }) o null
//   enviando = hay una captura en camino · activo = la sesión está en ventana de tolerancia
// Accesibilidad: solo la cifra va en aria-live (cambia cuando entra alguien, no cada 5 s del sondeo ni cada ciclo de captura); la línea
// de la última captura se lee al recorrer la pantalla pero no interrumpe.
export default function ResumenPaseLista({ totales = {}, ultima = null, enviando = false, activo = true, className }) {
    const inscritos = num(totales.inscritos);
    const presentes = num(totales.presentes);
    const retardos = num(totales.retardos);
    const sinRegistro = num(totales.sin_registro);
    const pendientes = num(totales.pendientes);
    const estados = distribucionSesionAbierta(totales);
    // `cambios` trae una entrada por cada alumno reconocido en la captura, haya cambiado algo o no: «registros nuevos» son los que se
    // crearon (primera lectura) o se confirmaron (tercera lectura, pasan a Presente o Retardo). Contar todas diría «+24» en cada ciclo.
    const cambios = (ultima?.cambios ?? []).filter((c) => c?.creado || c?.confirmado).length;

    return (
        <div className={className}>
            <p className="text-sm font-medium text-muted-foreground">Asistencia ahora</p>
            <p aria-live="polite" aria-atomic="true" className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-5xl font-semibold leading-none tracking-tight tabular-nums">{presentes}</span>{' '}
                <span className="text-lg text-muted-foreground">
                    de <span className="tabular-nums">{inscritos}</span> presentes
                </span>
            </p>
            <BarraSegmentada
                className="mt-3"
                datos={estados}
                config={CONFIG_SESION_ABIERTA}
                alto={8}
                leyenda={false}
                etiqueta={resumenTexto(estados, CONFIG_SESION_ABIERTA)}
                vacio="Aún no hay alumnos inscritos"
            />
            <p className="mt-2 text-sm text-muted-foreground">
                <span className="tabular-nums">{retardos}</span> con retardo · <span className="tabular-nums">{sinRegistro}</span> sin registro
                {pendientes > 0 && (
                    <>
                        {' '}
                        · <span className="tabular-nums">{pendientes}</span> por revisar
                    </>
                )}
            </p>
            <p className="mt-3 text-sm">
                {ultima ? (
                    <>
                        Última captura: <strong className="font-semibold tabular-nums">{ultima.rostros ?? 0}</strong> rostros · <strong className="font-semibold tabular-nums">{ultima.validas ?? 0}</strong> válidos
                        {cambios > 0 && <> · +{cambios} {cambios === 1 ? 'registro' : 'registros'}</>}
                        <TiempoRelativo desde={ultima.recibida} />
                        {enviando && <span className="text-muted-foreground"> · enviando…</span>}
                    </>
                ) : (
                    <span className="text-muted-foreground">
                        {!activo ? 'Fuera de la ventana de tolerancia: ya no se toman capturas.' : enviando ? 'Enviando la primera captura…' : 'Esperando la primera captura…'}
                    </span>
                )}
            </p>
        </div>
    );
}
