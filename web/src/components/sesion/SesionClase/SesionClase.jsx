'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import DataState from '@/components/ui/DataState';
import StatusChip from '@/components/ui/StatusChip';
import PageHeader from '@/components/layout/PageHeader';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, sesionMonitor } from '@/lib/api/sesiones.js';
import AbrirSesion, { textoUso } from '../AbrirSesion/AbrirSesion.jsx';
import MonitorSesion from '../MonitorSesion';
import { formatearFecha, formatearHora } from '../MonitorSesion/monitorSesion.utils.js';
import PaseListaManual from '../PaseListaManual';
import PasosPaseLista from '../PasosPaseLista';
import ResumenSesion from '../ResumenSesion';

const INTERVALO_SONDEO_MS = 5000;
// Errores de apertura tras los que la sesión ya cambió de estado: se vuelve a leer para mostrar el estado real (cerrada, suspendida).
const APERTURA_YA_RESUELTA = ['SESION_CERRADA', 'SESION_SUSPENDIDA'];

// Pantalla de una sesion de clase: es DONDE SE PASA LISTA, en tres pasos que la franja PasosPaseLista siempre muestra (abrir, pasar lista,
// revisar y cerrar). Lo primero que se ve depende del estado:
//   programada            paso 1: una tarjeta con una sola accion, «Abrir sesion y pasar lista» (AbrirSesion)
//   abierta automatica    pasos 2 y 3 (P-03, MonitorSesion): el panel con la camara y, aparte, la revision con el cierre
//   abierta manual        pasos 2 y 3 en una sola lista (P-04, PaseListaManual): se marca a cada alumno y se guarda y cierra
//   cerrada               resumen de solo lectura · suspendida: aviso
//   pasarLista = se llego con ?pasar-lista=1 (la sesion ya esta abierta): el panel de captura recibe el foco. Solo orienta la
//                presentacion: no concede nada (la autorizacion sigue siendo la de las RPC).
export default function SesionClase({ idSesion, pasarLista = false }) {
    const consulta = useApiQuery(sesionMonitor, { idSesion }, { refetchInterval: INTERVALO_SONDEO_MS });
    // api_ahora: la hora del plantel y, solo en desarrollo local, si el reloj es simulado (habilita la camara simulada). En produccion
    // `reloj_simulado` siempre es false.
    const reloj = useApiQuery(ahora, {});
    const abrir = useApiMutation(abrirSesion);
    const [abriendo, setAbriendo] = useState(false);
    const [recienAbierta, setRecienAbierta] = useState(false);
    const simulado = reloj.data?.reloj_simulado === true;

    const abrirAhora = async () => {
        setAbriendo(true);
        try {
            await abrir.run({ idSesion });
            setRecienAbierta(true);
            await consulta.refetch();
        } catch (e) {
            // El error queda en abrir.error y AbrirSesion lo explica con reintento; no hace falta un aviso aparte.
            if (APERTURA_YA_RESUELTA.includes(e?.code)) await consulta.refetch();
        } finally {
            setAbriendo(false);
        }
    };

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch}>
            {(data) => {
                const { sesion, camaras = [] } = data;
                const abierta = sesion.estatus === 'abierta';
                const automatica = sesion.modo_registro === 'automatico';
                const enfocar = abierta && (pasarLista || recienAbierta);
                const horario = `${formatearHora(sesion.hora_inicio)} a ${formatearHora(sesion.hora_fin)} · Aula ${sesion.aula}`;
                // Abierta o por abrir, la pantalla ES el pase de lista (el titulo lo dice); cerrada o suspendida es la ficha de la clase.
                const pasandoLista = abierta || sesion.estatus === 'programada';
                const titulo = pasandoLista ? (abierta && !automatica ? 'Pasar lista (manual)' : 'Pasar lista') : `${sesion.materia} (${sesion.clave_grupo})`;
                const subtitulo = pasandoLista ? `${sesion.materia} (${sesion.clave_grupo}) · ${formatearFecha(sesion.fecha)} · ${horario}` : `${formatearFecha(sesion.fecha)} · ${horario}`;
                return (
                    <div>
                        <PageHeader
                            title={titulo}
                            subtitle={subtitulo}
                            backHref="/docente"
                            backLabel="Volver al panel"
                            actions={
                                <>
                                    <StatusChip kind="sesion" value={sesion.estatus} />
                                    <StatusChip kind="modo" value={sesion.modo_registro} />
                                </>
                            }
                        />
                        {consulta.error && (
                            <Alert tone="warning" className="mb-3">
                                No se pudo actualizar el monitor: {consulta.error.message}
                            </Alert>
                        )}
                        {sesion.estatus === 'programada' && (
                            <div className="flex flex-col gap-4">
                                {/* El modo se fija al abrir (RN-06): antes de abrir se anticipa con las cámaras activas, igual que lo explica AbrirSesion. */}
                                <PasosPaseLista modo={textoUso(camaras).conCamara ? 'automatico' : 'manual'} actual={1} conDetalle={false} />
                                <AbrirSesion sesion={sesion} camaras={camaras} hora={reloj.data?.hora ?? null} onAbrir={abrirAhora} abriendo={abriendo} error={abrir.error} />
                            </div>
                        )}
                        {sesion.estatus === 'suspendida' && (
                            <Alert tone="warning" title="Sesión suspendida">
                                No cuenta para el cálculo de faltas.
                            </Alert>
                        )}
                        {sesion.estatus === 'cerrada' && <ResumenSesion data={data} />}
                        {abierta && automatica && <MonitorSesion data={data} onActualizar={consulta.refetch} enfocar={enfocar} simulado={simulado} />}
                        {abierta && !automatica && <PaseListaManual key={sesion.id_sesion} data={data} onActualizar={consulta.refetch} enfocar={enfocar} />}
                    </div>
                );
            }}
        </DataState>
    );
}
