import clsx from 'clsx';
import { ArrowRight, CalendarOff, Camera, CameraOff, ScanFace } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import {
    ANCLA_SESIONES_HOY,
    ETIQUETA_ACCION,
    detalleSesion,
    elegirProtagonista,
    faseSesion,
    textoCamara,
    textoVentana,
    tituloSesion,
    urlPasarLista,
    urlSesion,
} from '../pasarLista.utils.js';

// Tarjeta principal del panel del docente: «Pasar lista». Va ARRIBA de todo porque es lo que se hace a diario y no debe buscarse.
// Muestra UNA sesión protagonista (abierta > programada abrible > siguiente programada > última cerrada de hoy, ver
// elegirProtagonista) con su hora, aula, estado (chip junto a la etiqueta), cámara que se usará y un único botón primario que lo lleva
// al siguiente paso:
//   abierta            «Continuar pase de lista»  → /docente/sesiones/<id>?pasar-lista=1 (ya está abierta: entra directo)
//   programada abrible «Abrir y pasar lista»      → /docente/pasar-lista?sesion=<id> (abre la sesión y entra; maneja errores)
//   programada aún no  botón deshabilitado «Disponible a las HH:MM» + la regla de la ventana (RN-06: solo dentro del horario)
//   cerrada            «Ver resultados»           → /docente/sesiones/<id>
// Todos los botones son enlaces: el componente no llama a la API (la apertura vive en la ruta /docente/pasar-lista).
//   sesiones   `sesiones_hoy` de api_docente_panel · hora  hora del plantel de api_ahora ('HH:MM[:SS]'), opcional: sin ella no se
//   distingue «aún no es hora» de «ya pasó» · otrasHref  destino de «Otras sesiones de hoy» (por omisión, la lista del panel)
export default function PasarListaHero({ sesiones = [], hora = null, otrasHref = `#${ANCLA_SESIONES_HOY}`, className }) {
    const idTitulo = useId();
    const idRegla = useId();
    const lista = Array.isArray(sesiones) ? sesiones : [];
    const sesion = elegirProtagonista(lista, hora);
    const clases = clsx('rounded-xl border border-border bg-card p-5 sm:p-6', className);

    // `chip` (estado de la sesión) va a la derecha de la etiqueta: en teléfono ahorra una fila y el botón queda más arriba.
    const cabecera = (chip) => (
        <div className="flex items-center justify-between gap-3">
            <h2 id={idTitulo} className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tono-azul">
                    <ScanFace aria-hidden="true" className="size-5" strokeWidth={1.75} style={{ color: 'var(--tono-azul-fg)' }} />
                </span>
                Pasar lista
            </h2>
            {chip}
        </div>
    );

    if (!sesion) {
        return (
            <section aria-labelledby={idTitulo} data-fase="sin_sesiones" className={clases}>
                {cabecera()}
                <div className="mt-4 flex items-start gap-3">
                    <CalendarOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <div>
                        <p className="font-medium">Hoy no tienes clases programadas</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">Cuando haya una sesión en tu horario, aquí podrás abrirla y pasar lista.</p>
                    </div>
                </div>
            </section>
        );
    }

    const fase = faseSesion(sesion, hora);
    const camara = textoCamara(sesion);
    const otras = lista.length - 1;
    const iconoBoton = <ScanFace aria-hidden="true" className="size-5" strokeWidth={1.75} />;
    // Botón grande y a todo el ancho en teléfono; en pantallas anchas se queda a la derecha con un ancho cómodo.
    const claseBoton = 'h-12 sm:w-auto sm:min-w-[16rem]';

    let boton;
    let reglaVentana = null;
    if (fase === 'abierta') {
        boton = <Button href={urlSesion(sesion.id_sesion, { pasarLista: true })} fullWidth icon={iconoBoton} arrow className={claseBoton}>{ETIQUETA_ACCION.abierta}</Button>;
    } else if (fase === 'abrible') {
        boton = <Button href={urlPasarLista(sesion.id_sesion)} fullWidth icon={iconoBoton} arrow className={claseBoton}>{ETIQUETA_ACCION.abrible}</Button>;
    } else if (fase === 'cerrada' || fase === 'suspendida') {
        boton = <Button href={urlSesion(sesion.id_sesion)} variant="secondary" fullWidth arrow className={claseBoton}>{ETIQUETA_ACCION[fase]}</Button>;
    } else {
        // espera / vencida: no se puede abrir; se dice cuándo y por qué (regla de api_abrir_sesion), sin esconder el botón.
        const { etiqueta, regla } = textoVentana(sesion, hora);
        reglaVentana = regla;
        boton = <Button disabled fullWidth aria-describedby={idRegla} className={claseBoton}>{etiqueta}</Button>;
    }

    return (
        <section aria-labelledby={idTitulo} data-fase={fase} className={clases}>
            {cabecera(<StatusChip kind="sesion" value={sesion.estatus} size="sm" />)}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                    <h3 className="text-xl font-semibold leading-tight tracking-tight">{tituloSesion(sesion)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{detalleSesion(sesion)}</p>
                    {camara && (
                        <p className="mt-2.5 flex items-center gap-2 text-sm">
                            {camara.conCamara ? (
                                <Camera aria-hidden="true" className="size-4 shrink-0 text-presente" strokeWidth={1.75} />
                            ) : (
                                <CameraOff aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                            )}
                            <span>{camara.texto}</span>
                        </p>
                    )}
                </div>
                <div className="shrink-0 sm:w-auto">{boton}</div>
            </div>
            {reglaVentana && (
                <p id={idRegla} className="mt-3 text-xs text-muted-foreground">
                    {reglaVentana}
                </p>
            )}
            {otras > 0 && (
                <Link
                    href={otrasHref}
                    className="mt-4 inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                    Otras sesiones de hoy ({otras})
                    <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
                </Link>
            )}
        </section>
    );
}
