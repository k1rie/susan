'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import Spinner from '@/components/ui/Spinner';
import { useIndiceFacial } from './useIndiceFacial.js';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX') : '-');

function Dato({ k, v }) {
    return (
        <div className="rounded-md bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-lg font-semibold">{v}</dd>
        </div>
    );
}

export default function IndiceFacialPanel({ soloLectura = false }) {
    const { q, enCurso, resultado, cerrarResultado, reconstruir, sincronizar } = useIndiceFacial();
    const [abierto, setAbierto] = useState(false);
    const [completa, setCompleta] = useState(false);

    // El diálogo queda abierto (con Spinner) mientras corre; ConfirmDialog ya deshabilita sus botones.
    const confirmar = async () => {
        await reconstruir(completa);
        setAbierto(false);
    };

    return (
        <div className="flex flex-col gap-4">
            {enCurso && (
                <Alert tone="info">
                    <span className="flex items-center gap-2"><Spinner size="sm" label="Operación en curso" /> Operación del índice en curso; puede tardar varios minutos.</span>
                </Alert>
            )}
            {resultado && (
                <Alert tone={resultado.tono} title={resultado.titulo} onClose={cerrarResultado}>
                    <ul className="list-disc pl-5">{resultado.detalle.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </Alert>
            )}
            <DataState loading={q.loading} error={q.error} data={q.data} onRetry={q.refetch} isEmpty={() => false}>
                {(d) => {
                    const p = d.plantillas ?? {};
                    const servicio = d.servicio;
                    return (
                        <>
                            <Card
                                title="Versión en uso"
                                actions={
                                    !servicio?.disponible ? <Badge tone="danger">Servicio no disponible</Badge>
                                        : d.sincronizado === false ? <Badge tone="warning">Servicio desincronizado</Badge>
                                            : <Badge tone="success">Sincronizado con el servicio</Badge>
                                }
                            >
                                {d.en_uso ? (
                                    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                        <Dato k="Versión" v={d.en_uso.version} />
                                        <Dato k="Total de vectores" v={d.en_uso.total_vectores} />
                                        <Dato k="Dimensión" v={d.en_uso.dimension} />
                                        <Dato k="Construida" v={fecha(d.en_uso.fecha_construccion)} />
                                    </dl>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Aún no hay una versión del índice en uso.</p>
                                )}
                                {d.dimension_coincide === false && (
                                    <Alert tone="danger" className="mt-3">
                                        La dimensión configurada ({d.dimension_configurada}) no coincide con la del índice: reconstruya el índice completo.
                                    </Alert>
                                )}
                            </Card>
                            <Card title="Plantillas">
                                <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                    <Dato k="Activas" v={p.activas ?? 0} />
                                    <Dato k="Indexadas" v={p.indexadas ?? 0} />
                                    <Dato k="Pendientes de indexar" v={p.pendientes ?? 0} />
                                    <Dato k="Obsoletas en índice" v={p.obsoletas_en_indice ?? 0} />
                                </dl>
                                <p className="mt-3 text-sm">Requiere reconstrucción: <strong>{d.requiere_reconstruccion ? 'sí' : 'no'}</strong></p>
                                {!soloLectura && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Button disabled={enCurso} loading={enCurso} onClick={() => setAbierto(true)}>Reconstruir índice</Button>
                                        {servicio?.disponible && d.sincronizado === false && (
                                            <Button variant="secondary" disabled={enCurso} onClick={sincronizar}>Sincronizar servicio</Button>
                                        )}
                                    </div>
                                )}
                            </Card>
                            {d.pendientes_detalle?.length > 0 && (
                                <Card title="Plantillas pendientes de indexar">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead><tr><th className="py-1 pr-4">Plantilla</th><th className="py-1 pr-4">Alumno</th><th className="py-1">Registro</th></tr></thead>
                                            <tbody>
                                                {d.pendientes_detalle.map((x) => (
                                                    <tr key={x.id_plantilla} className="border-t border-border">
                                                        <td className="py-1 pr-4">{x.id_plantilla}</td>
                                                        <td className="py-1 pr-4">{x.id_alumno}</td>
                                                        <td className="py-1">{fecha(x.fecha_registro)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}
                            <Card title="Versiones">
                                {d.versiones?.items?.length ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead><tr><th className="py-1 pr-4">Versión</th><th className="py-1 pr-4">Vectores</th><th className="py-1 pr-4">Dimensión</th><th className="py-1 pr-4">Construida</th><th className="py-1">Estado</th></tr></thead>
                                            <tbody>
                                                {d.versiones.items.map((v) => (
                                                    <tr key={v.id_indice} className="border-t border-border">
                                                        <td className="py-1 pr-4">{v.version}</td>
                                                        <td className="py-1 pr-4">{v.total_vectores}</td>
                                                        <td className="py-1 pr-4">{v.dimension}</td>
                                                        <td className="py-1 pr-4">{fecha(v.fecha_construccion)}</td>
                                                        <td className="py-1">{v.en_uso ? <Badge tone="success">En uso</Badge> : 'Anterior'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Sin versiones construidas.</p>
                                )}
                            </Card>
                        </>
                    );
                }}
            </DataState>
            <ConfirmDialog
                open={abierto}
                title="Reconstruir índice facial"
                message="Se construirá una nueva versión con las plantillas activas y se activará al terminar. Puede tardar varios minutos."
                confirmLabel={enCurso ? 'Reconstruyendo...' : 'Reconstruir'}
                onConfirm={confirmar}
                onCancel={() => !enCurso && setAbierto(false)}
            >
                <Checkbox
                    className="mt-3"
                    label="Reconstrucción completa (reprocesa todas las fotos; tarda más)"
                    checked={completa}
                    disabled={enCurso}
                    onChange={(e) => setCompleta(e.target.checked)}
                />
                {enCurso && <p className="mt-2 flex items-center gap-2 text-sm"><Spinner size="sm" label="Reconstruyendo" /> Reconstruyendo, no cierre esta ventana...</p>}
            </ConfirmDialog>
        </div>
    );
}
