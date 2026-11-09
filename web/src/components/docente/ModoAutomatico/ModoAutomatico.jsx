'use client';

import { CalendarClock, Maximize, ScanFace, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import CapturaContinua from '@/components/sesion/CapturaContinua';
import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, docentePanel, sesionMonitor } from '@/lib/api/sesiones.js';
import { detalleSesion, hhmm, mensajeAperturaFallida, tituloSesion, urlSesion } from '../pasarLista.utils.js';
import {
    INTERVALO_MONITOR_MS, INTERVALO_REVISION_MS, elegirSesionAutomatica, pedirPantallaCompleta, salirPantallaCompleta, siguienteSesion,
} from './modoAutomatico.utils.js';

// =============================================================================================================================
// /docente/modo-automatico · «Modo automático»: la terminal del aula pasa lista sola, a pantalla completa, toda la jornada.
//
// Cada INTERVALO_REVISION_MS revisa las sesiones de hoy y toma la clase automática que empezó más recientemente (abierta o dentro de su
// horario); si está programada la abre (api_abrir_sesion, idempotente) y muestra la captura (CapturaContinua) sin el resto de la app.
// Cuando su ventana de tolerancia termina, la pantalla queda en espera con la próxima clase, y cambia sola cuando le toca. No cierra
// sesiones: eso lo hace el job cerrar-sesiones o el docente desde la pantalla de la sesión.
//
// La pantalla completa del navegador exige un gesto del usuario: el botón «Iniciar» la pide. Con ?iniciar=1 (kiosco de la Raspberry,
// que ya corre a pantalla completa) arranca sin el botón. «Salir» vuelve al panel.
// =============================================================================================================================
export default function ModoAutomatico({ iniciarAlCargar = false }) {
    const router = useRouter();
    const [iniciado, setIniciado] = useState(iniciarAlCargar);
    const panel = useApiQuery(docentePanel, {}, { enabled: iniciado, refetchInterval: INTERVALO_REVISION_MS });
    const reloj = useApiQuery(ahora, {}, { enabled: iniciado, refetchInterval: INTERVALO_REVISION_MS });
    const hora = reloj.data?.hora ?? null;
    const sesiones = panel.data?.sesiones_hoy;
    const actual = hora ? elegirSesionAutomatica(sesiones, hora) : null;
    const siguiente = hora ? siguienteSesion(sesiones, hora) : null;

    usePantallaEncendida(iniciado);

    const iniciar = () => {
        pedirPantallaCompleta();
        setIniciado(true);
    };
    const salir = async () => {
        await salirPantallaCompleta();
        router.push('/docente');
    };

    if (!iniciado) return <Inicio onIniciar={iniciar} />;

    const cargando = (panel.loading && !panel.data) || (reloj.loading && !reloj.data);
    return (
        // z-[46]: por encima del riel lateral (z-[44]/z-[45]) y de la barra inferior móvil (z-40); por debajo de diálogos (z-50) y avisos.
        <div className="fixed inset-0 z-[46] overflow-y-auto bg-background">
            <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
                <header className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modo automático{hora ? ` · ${hhmm(hora)}` : ''}</p>
                        <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{actual ? tituloSesion(actual) : 'Esperando la siguiente clase'}</h1>
                        {actual && <p className="text-sm text-muted-foreground">{detalleSesion(actual)}</p>}
                    </div>
                    <Button variant="secondary" size="sm" onClick={salir} icon={<X aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                        Salir
                    </Button>
                </header>

                {panel.error && !panel.data && (
                    <Alert tone="warning" title="No se pudieron leer las sesiones de hoy">
                        Se reintenta solo cada {INTERVALO_REVISION_MS / 1000} s.
                    </Alert>
                )}
                {cargando ? (
                    <Esperando titulo="Revisando tus clases de hoy…" />
                ) : actual ? (
                    <ClaseEnCurso key={actual.id_sesion} sesion={actual} siguiente={siguiente} onCambio={panel.refetch} onIrA={(id) => router.push(urlSesion(id, { pasarLista: true }))} />
                ) : (
                    <SinClase siguiente={siguiente} />
                )}
            </div>
        </div>
    );
}

// Abre (si hace falta) la sesión elegida y muestra su captura. Se monta de nuevo (key) cuando cambia la clase.
function ClaseEnCurso({ sesion, siguiente, onCambio, onIrA }) {
    const [abierta, setAbierta] = useState(sesion.estatus === 'abierta');
    const [fallo, setFallo] = useState(null);
    const [intento, setIntento] = useState(0);
    const monitor = useApiQuery(sesionMonitor, { idSesion: sesion.id_sesion }, { enabled: abierta, refetchInterval: INTERVALO_MONITOR_MS });

    useEffect(() => {
        if (abierta) return undefined;
        let vigente = true;
        abrirSesion({ idSesion: sesion.id_sesion }).then(
            () => {
                if (!vigente) return;
                setAbierta(true);
                onCambio?.();
            },
            (error) => {
                if (vigente) setFallo(error);
            },
        );
        return () => {
            vigente = false;
        };
    }, [abierta, sesion.id_sesion, intento, onCambio]);

    if (fallo) {
        const m = mensajeAperturaFallida(fallo);
        return (
            <Alert tone="warning" title={m.titulo}>
                <p>{m.descripcion}</p>
                {m.reintentable && (
                    <Button
                        variant="secondary"
                        className="mt-3 w-full sm:w-auto"
                        onClick={() => {
                            setFallo(null);
                            setIntento((n) => n + 1);
                        }}
                    >
                        Reintentar
                    </Button>
                )}
            </Alert>
        );
    }
    const data = monitor.data;
    if (!abierta || !data) return <Esperando titulo="Abriendo la clase…" />;
    if (data.sesion?.en_ventana !== true) {
        return <SinClase siguiente={siguiente} titulo="Terminó la ventana de captura de esta clase" />;
    }
    return (
        <CapturaContinua
            sesion={data.sesion}
            camaras={data.camaras ?? []}
            alumnos={data.alumnos ?? []}
            totales={data.totales ?? {}}
            activo
            onFin={() => {
                monitor.refetch();
                onCambio?.();
            }}
            onRevisar={() => onIrA(sesion.id_sesion)}
            onRegistrarManual={() => onIrA(sesion.id_sesion)}
        />
    );
}

function Inicio({ onIniciar }) {
    return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-4 py-12 text-center sm:px-8">
            <ScanFace aria-hidden="true" className="size-10 text-muted-foreground" strokeWidth={1.5} />
            <div className="flex max-w-md flex-col gap-1">
                <h1 className="text-xl font-semibold text-foreground">Modo automático</h1>
                <p className="text-sm text-muted-foreground">
                    La pantalla pasa lista sola con la cámara, a pantalla completa, en la clase que toque en cada momento. Deja este equipo
                    encendido frente al grupo.
                </p>
            </div>
            <Button onClick={onIniciar} icon={<Maximize aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                Iniciar
            </Button>
        </div>
    );
}

function Esperando({ titulo }) {
    return (
        <div aria-live="polite" className="flex flex-col items-center gap-3 py-16 text-center">
            <Spinner />
            <p className="text-sm text-muted-foreground">{titulo}</p>
        </div>
    );
}

function SinClase({ siguiente, titulo = 'No hay una clase en curso' }) {
    return (
        <div aria-live="polite" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-16 text-center">
            <CalendarClock aria-hidden="true" className="size-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-base font-medium text-foreground">{titulo}</p>
            <p className="max-w-md text-sm text-muted-foreground">
                {siguiente
                    ? `Siguiente: ${tituloSesion(siguiente)} a las ${hhmm(siguiente.hora_inicio)}. Empezará sola.`
                    : 'No quedan clases con cámara hoy.'}
            </p>
        </div>
    );
}

// Mantiene la pantalla encendida mientras corre (Screen Wake Lock); el navegador la suelta al ocultar la pestaña y se pide de nuevo al volver.
function usePantallaEncendida(activo) {
    useEffect(() => {
        if (!activo || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
        let candado = null;
        const pedir = () => {
            if (document.visibilityState !== 'visible') return;
            navigator.wakeLock.request('screen').then((c) => {
                candado = c;
            }, () => {});
        };
        pedir();
        document.addEventListener('visibilitychange', pedir);
        return () => {
            document.removeEventListener('visibilitychange', pedir);
            candado?.release?.().catch?.(() => {});
        };
    }, [activo]);
}
