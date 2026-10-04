'use client';

import { CalendarOff, Camera, CameraOff, ScanFace } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import StatusChip from '@/components/ui/StatusChip';
import { useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, docentePanel } from '@/lib/api/sesiones.js';
import {
    ANCLA_SESIONES_HOY,
    ETIQUETA_ACCION,
    detalleSesion,
    faseSesion,
    mensajeAperturaFallida,
    motivoSinCandidatas,
    sesionesCandidatas,
    textoCamara,
    tituloSesion,
    urlSesion,
} from '../pasarLista.utils.js';

// =============================================================================================================================
// /docente/pasar-lista · «Pasar lista»: el camino corto desde cualquier parte hasta el pase de lista.
//
// CONTRATO DE LLEGADA PARA LA PANTALLA DE SESIÓN (SesionClase, la reorganiza otro flujo):
//   Esta ruta deja la sesión ABIERTA (api_abrir_sesion es idempotente: si ya lo estaba, solo la lee) y navega con router.replace a
//
//       /docente/sesiones/<id>?pasar-lista=1
//
//   Con ?pasar-lista=1 la sesión YA está abierta y el docente llega a pasar lista, así que la pantalla debe mostrar PRIMERO la captura
//   (sesión automática: CapturaContinua/monitor con la cámara; manual: el pase de lista a mano) y dejar lo demás (resumen, tablas,
//   gráficas) debajo o plegado. Sin el parámetro la pantalla se comporta como hasta ahora. El parámetro solo orienta la presentación:
//   no concede nada ni cambia datos (la autorización sigue siendo la de las RPC). Constante: PARAM_PASAR_LISTA (pasarLista.utils.js).
//
// ENTRADAS DE ESTA RUTA
//   /docente/pasar-lista            elige sola: UNA sesión candidata (abierta o programada dentro de su horario) → la abre y entra;
//                                   varias → tarjetas para elegir; ninguna → explica por qué (sin clases / fuera de horario).
//   /docente/pasar-lista?sesion=<id> abre esa sesión (la tarjeta principal del panel enlaza así a las programadas) y entra. Sin
//                                   consultar el panel; los errores de api_abrir_sesion se muestran con reintento.
// La ruta (app/(app)/docente/pasar-lista/page.jsx) está dentro del layout de /docente, que ya exige el rol docente.
// =============================================================================================================================
export default function PasarLista({ idSesionInicial = null }) {
    const router = useRouter();
    const conId = idSesionInicial != null;
    const panel = useApiQuery(docentePanel, {}, { enabled: !conId });
    const reloj = useApiQuery(ahora, {}, { enabled: !conId });
    const hora = reloj.data?.hora ?? null;
    const sesionesHoy = panel.data?.sesiones_hoy;

    const candidatas = sesionesCandidatas(sesionesHoy, hora);
    // Elegida a mano en las tarjetas; si no hay elección, la sesión indicada en la URL o la única candidata.
    const [elegido, setElegido] = useState(null);
    const unica = candidatas.length === 1 ? candidatas[0] : null;
    const idObjetivo = elegido ?? idSesionInicial ?? unica?.id_sesion ?? null;
    const yaAbierta = (sesionesHoy ?? []).find((s) => s.id_sesion === idObjetivo)?.estatus === 'abierta';
    const [fallo, setFallo] = useState(null); // { idSesion, error }
    const [intento, setIntento] = useState(0);

    // Abre (si hace falta) y entra. Sin el panel no se sabe si ya estaba abierta: api_abrir_sesion es idempotente, así que se llama igual.
    useEffect(() => {
        if (idObjetivo == null) return undefined;
        let vigente = true;
        const entrar = async () => {
            if (!yaAbierta) await abrirSesion({ idSesion: idObjetivo });
            return urlSesion(idObjetivo, { pasarLista: true });
        };
        entrar().then(
            (destino) => {
                // replace: la pantalla puente no debe quedar en el historial (el «atrás» del navegador volvería a abrir la sesión).
                if (vigente) router.replace(destino);
            },
            (error) => {
                if (vigente) setFallo({ idSesion: idObjetivo, error });
            },
        );
        return () => {
            vigente = false;
        };
    }, [idObjetivo, yaAbierta, intento, router]);

    const reintentar = () => {
        setFallo(null);
        setIntento((n) => n + 1);
    };
    const elegir = (idSesion) => {
        setFallo(null);
        setElegido(idSesion);
        setIntento((n) => n + 1);
    };
    const falloVigente = fallo && fallo.idSesion === idObjetivo ? fallo : null;
    const abriendo = idObjetivo != null && !falloVigente;

    const cabecera = (
        <PageHeader
            title="Pasar lista"
            subtitle="Abre la clase y registra la asistencia"
            backHref="/docente"
            backLabel="Volver al panel"
        />
    );

    // Con sesión indicada en la URL no hay nada que elegir: abre o falla.
    if (conId) {
        return (
            <div>
                {cabecera}
                {falloVigente ? <ErrorApertura fallo={falloVigente} onReintentar={reintentar} /> : <Abriendo />}
            </div>
        );
    }

    return (
        <div>
            {cabecera}
            <DataState loading={panel.loading} error={panel.error} data={panel.data} onRetry={panel.refetch} isEmpty={() => false}>
                {() => {
                    // Sin la hora del plantel el motivo («aún no» o «ya pasó») sería impreciso: se espera a que llegue.
                    if (candidatas.length === 0) return reloj.loading ? <Abriendo texto="Revisando tus sesiones de hoy…" detalle="" /> : <SinSesiones sesiones={sesionesHoy} hora={hora} />;
                    if (candidatas.length === 1) return falloVigente ? <ErrorApertura fallo={falloVigente} onReintentar={reintentar} /> : <Abriendo />;
                    return (
                        <div className="flex flex-col gap-4">
                            {falloVigente && <ErrorApertura fallo={falloVigente} onReintentar={reintentar} />}
                            <p className="text-sm text-muted-foreground">Tienes {candidatas.length} sesiones disponibles ahora. Elige en cuál pasar lista.</p>
                            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {candidatas.map((s) => (
                                    <li key={s.id_sesion}>
                                        <TarjetaSesion sesion={s} hora={hora} cargando={abriendo && idObjetivo === s.id_sesion} bloqueada={abriendo} onElegir={elegir} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                }}
            </DataState>
        </div>
    );
}

// Estado de carga mientras se abre la sesión y se navega.
function Abriendo({ texto = 'Abriendo la sesión…', detalle = 'Un momento: te llevamos a la pantalla para pasar lista.' }) {
    return (
        // El Spinner ya es un role="status" con su texto oculto; aquí solo se anuncia el cambio de texto (aria-live), sin anidar estados.
        <div aria-live="polite" className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Spinner size="lg" label="Cargando" />
            <p className="text-lg font-medium">{texto}</p>
            {detalle && <p className="max-w-sm text-sm text-muted-foreground">{detalle}</p>}
        </div>
    );
}

// Error de api_abrir_sesion con mensaje comprensible, reintento y salida a las sesiones de hoy (o a la sesión cuando tiene sentido).
function ErrorApertura({ fallo, onReintentar }) {
    const { titulo, descripcion, reintentable, verSesion } = mensajeAperturaFallida(fallo.error);
    return (
        <div className="flex flex-col gap-3">
            <Alert tone="danger" title={titulo}>
                {descripcion}
            </Alert>
            <div className="flex flex-col gap-2 sm:flex-row">
                {reintentable && (
                    <Button onClick={onReintentar} className="sm:w-auto" fullWidth>
                        Reintentar
                    </Button>
                )}
                {verSesion && (
                    <Button href={urlSesion(fallo.idSesion)} fullWidth className="sm:w-auto">
                        {verSesion}
                    </Button>
                )}
                <Button variant="secondary" href={`/docente#${ANCLA_SESIONES_HOY}`} fullWidth className="sm:w-auto">
                    Ver sesiones de hoy
                </Button>
            </div>
        </div>
    );
}

// Tarjeta grande para elegir entre varias sesiones candidatas.
function TarjetaSesion({ sesion, hora, cargando, bloqueada, onElegir }) {
    const camara = textoCamara(sesion);
    const fase = faseSesion(sesion, hora);
    return (
        <article className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip kind="sesion" value={sesion.estatus} size="sm" />
                <StatusChip kind="modo" value={sesion.modo_previsto} size="sm" title="Modo de registro previsto" />
            </div>
            <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight tracking-tight">{tituloSesion(sesion)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{detalleSesion(sesion)}</p>
            </div>
            {camara && (
                <p className="flex items-center gap-2 text-sm">
                    {camara.conCamara ? (
                        <Camera aria-hidden="true" className="size-4 shrink-0 text-presente" strokeWidth={1.75} />
                    ) : (
                        <CameraOff aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    )}
                    <span>{camara.texto}</span>
                </p>
            )}
            <Button
                className="mt-auto h-12"
                fullWidth
                arrow
                icon={<ScanFace aria-hidden="true" className="size-5" strokeWidth={1.75} />}
                loading={cargando}
                disabled={bloqueada}
                onClick={() => onElegir(sesion.id_sesion)}
                aria-label={`${ETIQUETA_ACCION[fase]}: ${tituloSesion(sesion)}`}
            >
                {ETIQUETA_ACCION[fase]}
            </Button>
        </article>
    );
}

// Ninguna sesión para pasar lista ahora: se explica por qué y se ofrece a dónde ir.
function SinSesiones({ sesiones, hora }) {
    const { titulo, descripcion } = motivoSinCandidatas(sesiones, hora);
    return (
        <EmptyState
            icon={<CalendarOff aria-hidden="true" className="size-6" strokeWidth={1.5} />}
            title={titulo}
            description={descripcion}
            action={
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <Button href={`/docente#${ANCLA_SESIONES_HOY}`} variant="secondary">
                        Ver sesiones de hoy
                    </Button>
                    <Button href="/docente/revision" variant="secondary">
                        Ir a Revisión
                    </Button>
                </div>
            }
        />
    );
}
