'use client';

import { Clock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import CampoFecha from '@/components/ui/CampoFecha';
import DataState from '@/components/ui/DataState';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import PanelLateral from '@/components/ui/PanelLateral';
import Select from '@/components/ui/Select';
import SuccessState from '@/components/ui/SuccessState';
import Textarea from '@/components/ui/Textarea';
import { duracionTexto, formatoFechaCorta, rangoHoras } from '../../laboratorios.utils.js';
import DisponibilidadDia from '../DisponibilidadDia';
import { ACTIVIDAD_MAX, ATAJOS_FECHA, opcionesGrupo, opcionesLaboratorio } from './solicitudForm.utils.js';
import { useSolicitudForm } from './useSolicitudForm.js';

const textoDias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
const textoHoras = (n) => `${n} ${n === 1 ? 'hora' : 'horas'}`;

/**
 * Panel lateral «Nueva solicitud de laboratorio» (un paso, 6 campos: encaja con PanelLateral según docs/design/formularios).
 * Valida al salir del campo, avisa de capacidad y traslapes ANTES de enviar (el servidor igual decide) y muestra sus errores pegados
 * al campo que los causó. Al terminar deja claro que la solicitud queda pendiente.
 *
 *   onClose()          cierra el panel.
 *   onCreada(solicitud) tras un envío exitoso (la pantalla avisa y refresca la lista de detrás).
 */
export default function SolicitudForm({ onClose, onCreada }) {
    const s = useSolicitudForm({ onCreada });
    const { f, reglas } = s;
    const avisoRef = useRef(null);
    // El aviso general va arriba del formulario: si la persona había bajado en el panel, se le trae a la vista.
    useEffect(() => {
        if (f.errorEnvio) avisoRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [f.errorEnvio]);

    // Los campos aparecen cuando llegan los catálogos (el panel ya estaba abierto) y de nuevo con «Hacer otra solicitud»: el foco va al
    // primero que falte por llenar. Va en un temporizador para que la preselección (un solo grupo o laboratorio) ya esté pintada.
    const listo = Boolean(s.catalogos) && !s.cargando;
    const hayFormulario = listo && !s.creada;
    useEffect(() => {
        if (!hayFormulario) return undefined;
        const id = setTimeout(() => {
            const controles = [...(document.getElementById(s.formId)?.querySelectorAll('select:not(:disabled), input:not([type="hidden"]):not(:disabled), textarea:not(:disabled)') ?? [])];
            (controles.find((el) => !el.value) ?? controles[0])?.focus();
        }, 0);
        return () => clearTimeout(id);
    }, [hayFormulario, s.formId]);

    const laboratorio = s.campo('id_aula');
    const grupo = s.campo('id_grupo');
    const fecha = s.campo('fecha');
    const inicio = s.campo('hora_inicio');
    const fin = s.campo('hora_fin');
    const actividad = s.campo('actividad');

    const duracion = duracionTexto(f.valores.hora_inicio, f.valores.hora_fin);
    const sinLaboratorios = s.catalogos?.laboratorios.length === 0;
    const sinGrupos = s.catalogos?.grupos.length === 0;
    const motivoBloqueo = sinLaboratorios
        ? 'No hay laboratorios registrados.'
        : sinGrupos
          ? 'No tienes grupos asignados.'
          : Object.keys(f.errores).length > 0
            ? 'Revisa los campos marcados.'
            : undefined;
    const hayEstado = Boolean(motivoBloqueo) || f.sucio;
    const creada = s.creada;

    return (
        <PanelLateral
            open
            onClose={onClose}
            title="Nueva solicitud de laboratorio"
            description={creada ? undefined : 'Elige el laboratorio, el grupo y el horario. Queda pendiente hasta que el administrador la revise.'}
            dirty={f.sucio}
            closeDisabled={f.enviando}
            footer={
                creada
                    ? undefined
                    : ({ cerrar }) => (
                          // Estado arriba y botones abajo: así el motivo puede crecer sin mover los botones (pie estrecho de un panel).
                          <div className="flex w-full flex-col">
                              <FormActions flat dirty={f.sucio} motivoBloqueo={motivoBloqueo} className={hayEstado ? 'pb-2' : undefined} />
                              <FormActions flat>
                                  <Button variant="secondary" onClick={cerrar} disabled={f.enviando}>
                                      Cancelar
                                  </Button>
                                  <Button type="submit" form={s.formId} loading={f.enviando} disabled={!s.catalogos || s.cargando || sinLaboratorios || sinGrupos}>
                                      Enviar solicitud
                                  </Button>
                              </FormActions>
                          </div>
                      )
            }
        >
            <DataState loading={s.cargando} error={s.error} data={s.cargando ? null : s.catalogos} onRetry={s.reintentar} isEmpty={() => false}>
                {(catalogos) =>
                    creada ? (
                        <SuccessState
                            title="Solicitud enviada"
                            description={`${creada.aula.clave}, ${formatoFechaCorta(creada.fecha, reglas.hoy)}, ${rangoHoras(creada.hora_inicio, creada.hora_fin)}, grupo ${creada.grupo.clave_grupo}. Queda pendiente hasta que el administrador la revise; verás su respuesta en «Mis solicitudes».`}
                            actions={[
                                { label: 'Ver mis solicitudes', onClick: onClose },
                                { label: 'Hacer otra solicitud', onClick: s.hacerOtra, variant: 'secondary' },
                            ]}
                        />
                    ) : (
                        <form id={s.formId} onSubmit={s.enviar} noValidate className="flex flex-col gap-6 pb-2">
                            {f.errorEnvio && (
                                <div ref={avisoRef}>
                                    <Alert tone="danger" compact title="No se pudo enviar la solicitud">
                                        {f.errorEnvio.message || 'Intenta de nuevo en un momento.'}
                                    </Alert>
                                </div>
                            )}

                            <FormSection title="Laboratorio y grupo">
                                <Field label="Laboratorio" required error={laboratorio.error} reserveError>
                                    <Select {...laboratorio.props} options={opcionesLaboratorio(catalogos.laboratorios)} placeholder="Elige un laboratorio" disabled={sinLaboratorios} />
                                </Field>
                                <Field label="Grupo" required error={grupo.error} reserveError>
                                    <Select {...grupo.props} options={opcionesGrupo(catalogos.grupos)} placeholder="Elige uno de tus grupos" disabled={sinGrupos} />
                                </Field>
                                {sinLaboratorios && (
                                    <Alert tone="info" compact>
                                        Todavía no hay laboratorios registrados. Pide al administrador que los dé de alta.
                                    </Alert>
                                )}
                                {sinGrupos && (
                                    <Alert tone="info" compact>
                                        No tienes grupos asignados en el periodo actual, así que no puedes solicitar un laboratorio.
                                    </Alert>
                                )}
                                {s.avisoCapacidad && (
                                    <Alert tone="warning" compact role="status" title="El grupo no cabe en este laboratorio">
                                        {s.avisoCapacidad}
                                    </Alert>
                                )}
                            </FormSection>

                            <FormSection
                                title="Fecha y horario"
                                description={`Pídelo con al menos ${textoHoras(reglas.anticipacionHoras)} de anticipación y hasta ${textoDias(reglas.horizonteDias)} antes.`}
                                columns={2}
                            >
                                <Field label="Fecha de uso" required error={fecha.error} reserveError className="@md:col-span-2">
                                    <CampoFecha {...fecha.props} min={reglas.primero.fecha} max={reglas.fechaMaxima} hoy={reglas.hoy} atajos={ATAJOS_FECHA} />
                                </Field>
                                <DisponibilidadDia
                                    className="@md:col-span-2"
                                    aula={s.laboratorio}
                                    fecha={s.fechaFirme}
                                    consultable={s.consultable}
                                    consulta={s.agenda}
                                    choques={s.choques}
                                />
                                <Field label="Hora de inicio" required error={inicio.error} reserveError>
                                    <Input type="time" {...inicio.props} />
                                </Field>
                                <Field label="Hora de fin" required error={fin.error} reserveError>
                                    <Input type="time" {...fin.props} />
                                </Field>
                                {duracion && (
                                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground @md:col-span-2">
                                        <Clock aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                                        Duración: {duracion}
                                    </p>
                                )}
                                {s.avisoTraslape && (
                                    <Alert tone={s.avisoTraslape.tono} compact role="status" title={s.avisoTraslape.titulo} className="@md:col-span-2">
                                        {s.avisoTraslape.detalle}
                                    </Alert>
                                )}
                            </FormSection>

                            <FormSection title="Actividad">
                                <Field label="Actividad" required error={actividad.error} hint="Qué harán los alumnos en el laboratorio." example="Práctica de balanza de comprobación" reserveError>
                                    <Textarea {...actividad.props} rows={3} maxLength={ACTIVIDAD_MAX} showCount />
                                </Field>
                            </FormSection>
                        </form>
                    )
                }
            </DataState>
        </PanelLateral>
    );
}
