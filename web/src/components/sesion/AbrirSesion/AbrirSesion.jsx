'use client';

import { Camera, CameraOff, ScanFace } from 'lucide-react';
import { useId } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { aMinutos, faseSesion, mensajeAperturaFallida, textoVentana } from '@/components/docente/pasarLista.utils.js';

/** Qué se usará para pasar lista, según las cámaras activas del aula (RN-06: el modo se fija al abrir). */
export function textoUso(camaras) {
    const activas = (camaras ?? []).filter((c) => c.estatus === 'activa').length;
    if (activas > 0) {
        return {
            conCamara: true,
            texto: `Se usará la cámara del aula (${activas} ${activas === 1 ? 'activa' : 'activas'}): apuntas al grupo y el sistema reconoce a los alumnos. Si falla, puedes registrar a mano.`,
        };
    }
    return { conCamara: false, texto: 'El aula no tiene cámaras activas: pasarás lista a mano, alumno por alumno.' };
}

// Sesión PROGRAMADA: una tarjeta grande con una sola acción. Lo único que se puede hacer con ella es abrirla, así que no se muestra
// nada más (ni gráficas ni tablas vacías).
//   sesion = de api_sesion_monitor · camaras = las del aula · hora = hora del plantel de api_ahora ('HH:MM[:SS]'), opcional
//   onAbrir = abre la sesión (api_abrir_sesion) · abriendo = hay una apertura en curso · error = ApiError de la última apertura o null
// Errores (FUERA_DE_HORARIO, SESION_CERRADA…) con mensaje comprensible (mensajeAperturaFallida) y reintento cuando tiene sentido.
export default function AbrirSesion({ sesion, camaras = [], hora = null, onAbrir, abriendo = false, error = null }) {
    const idTitulo = useId();
    const uso = textoUso(camaras);
    // `abrible` solo lo trae el panel; aquí se deduce de la hora del plantel para distinguir «aún no» de «ya pasó».
    const ahora = aMinutos(hora);
    const dentro = ahora != null && ahora >= (aMinutos(sesion.hora_inicio) ?? Infinity) && ahora < (aMinutos(sesion.hora_fin) ?? -Infinity);
    const ventana = textoVentana({ hora_inicio: sesion.hora_inicio, hora_fin: sesion.hora_fin }, hora);
    const fase = faseSesion({ estatus: 'programada', abrible: dentro, hora_fin: sesion.hora_fin }, hora);
    const fallo = error ? mensajeAperturaFallida(error) : null;
    // Un error sin salida (sesión cerrada, suspendida, ajena) no se reintenta: el botón solo estorbaría.
    const mostrarBoton = !fallo || fallo.reintentable;

    return (
        <section aria-labelledby={idTitulo} className="rounded-xl border border-border bg-card p-5 sm:p-8">
            <div className="flex max-w-xl flex-col gap-5">
                <span className="flex size-12 items-center justify-center rounded-xl bg-tono-azul">
                    <ScanFace aria-hidden="true" className="size-6" strokeWidth={1.75} style={{ color: 'var(--tono-azul-fg)' }} />
                </span>
                <div>
                    <h2 id={idTitulo} className="text-xl font-semibold leading-tight tracking-tight">
                        Esta clase aún no está abierta
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">Ábrela para empezar a pasar lista.</p>
                </div>
                <p className="flex items-start gap-2.5 text-sm">
                    {uso.conCamara ? (
                        <Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-presente" strokeWidth={1.75} />
                    ) : (
                        <CameraOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    )}
                    <span>{uso.texto}</span>
                </p>
                {fallo && (
                    <Alert tone="danger" title={fallo.titulo}>
                        {fallo.descripcion}
                    </Alert>
                )}
                {mostrarBoton && (
                    <Button
                        onClick={onAbrir}
                        loading={abriendo}
                        arrow
                        icon={<ScanFace aria-hidden="true" className="size-5" strokeWidth={1.75} />}
                        className="min-h-12 w-full sm:w-auto sm:min-w-[18rem]"
                    >
                        {fallo ? 'Reintentar abrir la sesión' : 'Abrir sesión y pasar lista'}
                    </Button>
                )}
                <div className="flex flex-col items-start gap-1.5">
                    {(fase === 'espera' || fase === 'vencida') && ahora != null && <Badge tone="warning">{ventana.etiqueta}</Badge>}
                    <p className="text-xs text-muted-foreground">{ventana.regla}</p>
                </div>
            </div>
        </section>
    );
}
