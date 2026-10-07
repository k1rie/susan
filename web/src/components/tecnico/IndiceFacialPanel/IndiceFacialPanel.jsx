'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import AnilloEstados from '@/components/ui/AnilloEstados';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import Detalles from '@/components/ui/Detalles';
import Spinner from '@/components/ui/Spinner';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { CONFIG_PLANTILLAS, datosPlantillas, fechaHora, porcentajeIndexado, resumenPlantillas, textoPlantillas, textoVersiones } from './indiceFacial.utils.js';
import { useIndiceFacial } from './useIndiceFacial.js';

function Dato({ k, v }) {
    return (
        <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 break-words text-base font-semibold tabular-nums">{v}</dd>
        </div>
    );
}

export default function IndiceFacialPanel({ soloLectura = false }) {
    const { q, enCurso, resultado, cerrarResultado, reconstruir, sincronizar } = useIndiceFacial();
    const [abierto, setAbierto] = useState(false);
    const [completa, setCompleta] = useState(false);
    // Con la dimensión del índice distinta de la configurada una reconstrucción parcial no sirve (el aviso de la tarjeta la pide completa):
    // la casilla ya sale marcada y lo explica.
    const dimensionNoCoincide = q.data?.dimension_coincide === false;
    const plantillasActivas = q.data?.plantillas?.activas;

    const abrirReconstruccion = () => {
        setCompleta(dimensionNoCoincide);
        setAbierto(true);
    };

    // El diálogo queda abierto (con Spinner) mientras corre; ConfirmDialog ya deshabilita sus botones.
    const confirmar = async () => {
        await reconstruir(completa);
        setAbierto(false);
    };

    return (
        <div className="flex flex-col gap-4">
            {enCurso && (
                <Alert tone="info">
                    <span className="flex items-center gap-2"><Spinner size="sm" label="Operación en curso" /> Operación en curso; puede tardar varios minutos.</span>
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
                            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                <Card
                                    title="Versión en uso"
                                    actions={
                                        !servicio?.disponible ? <Badge tone="danger">Servicio no disponible</Badge>
                                            : d.sincronizado === false ? <Badge tone="warning">Servicio desincronizado</Badge>
                                                : <Badge tone="success">Sincronizado con el servicio</Badge>
                                    }
                                >
                                    {d.en_uso ? (
                                        <dl className="grid grid-cols-2 gap-2">
                                            <Dato k="Versión" v={d.en_uso.version} />
                                            <Dato k="Vectores" v={d.en_uso.total_vectores} />
                                            <Dato k="Dimensión" v={d.en_uso.dimension} />
                                            <Dato k="Construida" v={fechaHora(d.en_uso.fecha_construccion)} />
                                        </dl>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Aún no hay una versión del índice en uso.</p>
                                    )}
                                    {d.dimension_coincide === false && (
                                        <Alert tone="danger" className="mt-3">
                                            La dimensión configurada ({d.dimension_configurada}) no coincide con la del índice: reconstruya el índice completo.
                                        </Alert>
                                    )}
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Badge tone={d.requiere_reconstruccion ? 'warning' : 'success'}>
                                            {d.requiere_reconstruccion ? 'Requiere reconstrucción' : 'Índice al día'}
                                        </Badge>
                                        {!soloLectura && (
                                            <>
                                                {/* Con el índice al día, reconstruir es mantenimiento, no la siguiente tarea: no compite como acción primaria. */}
                                                <Button variant={d.requiere_reconstruccion ? 'primary' : 'secondary'} disabled={enCurso} loading={enCurso} onClick={abrirReconstruccion}>Reconstruir índice</Button>
                                                {servicio?.disponible && d.sincronizado === false && (
                                                    <Button variant="secondary" disabled={enCurso} onClick={sincronizar}>Sincronizar servicio</Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </Card>
                                <TarjetaGrafica
                                    titulo="Plantillas"
                                    descripcion={`${p.activas ?? 0} activas${(p.obsoletas_en_indice ?? 0) > 0 ? ` · ${p.obsoletas_en_indice} obsoletas en el índice` : ''}`}
                                    resumen={resumenPlantillas(p)}
                                >
                                    <AnilloEstados
                                        datos={datosPlantillas(p)}
                                        config={CONFIG_PLANTILLAS}
                                        centro={{ valor: `${porcentajeIndexado(p)} %`, etiqueta: 'Indexadas' }}
                                        alto={240}
                                        vacio="No hay plantillas activas"
                                    />
                                </TarjetaGrafica>
                            </div>
                            {d.pendientes_detalle?.length > 0 && (
                                <Detalles titulo="Plantillas pendientes de indexar" resumen={textoPlantillas(d.pendientes_detalle.length)}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead><tr><th scope="col" className="py-1 pr-4">Plantilla</th><th scope="col" className="py-1 pr-4">Alumno</th><th scope="col" className="py-1">Registro</th></tr></thead>
                                            <tbody>
                                                {d.pendientes_detalle.map((x) => (
                                                    <tr key={x.id_plantilla} className="border-t border-border">
                                                        <td className="py-1 pr-4">{x.id_plantilla}</td>
                                                        <td className="py-1 pr-4">{x.id_alumno}</td>
                                                        <td className="py-1">{fechaHora(x.fecha_registro)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Detalles>
                            )}
                            <Detalles titulo="Versiones del índice" resumen={d.versiones?.items?.length ? textoVersiones(d.versiones.items.length) : 'Sin versiones'}>
                                {d.versiones?.items?.length ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead><tr><th scope="col" className="py-1 pr-4">Versión</th><th scope="col" className="py-1 pr-4">Vectores</th><th scope="col" className="py-1 pr-4">Dimensión</th><th scope="col" className="py-1 pr-4">Construida</th><th scope="col" className="py-1">Estado</th></tr></thead>
                                            <tbody>
                                                {d.versiones.items.map((v) => (
                                                    <tr key={v.id_indice} className="border-t border-border">
                                                        <td className="py-1 pr-4">{v.version}</td>
                                                        <td className="py-1 pr-4">{v.total_vectores}</td>
                                                        <td className="py-1 pr-4">{v.dimension}</td>
                                                        <td className="py-1 pr-4">{fechaHora(v.fecha_construccion)}</td>
                                                        <td className="py-1">{v.en_uso ? <Badge tone="success">En uso</Badge> : 'Anterior'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Sin versiones construidas.</p>
                                )}
                            </Detalles>
                        </>
                    );
                }}
            </DataState>
            <ConfirmDialog
                open={abierto}
                title="Reconstruir índice facial"
                message={`Se construirá una nueva versión con ${plantillasActivas != null ? `las ${plantillasActivas} plantillas activas` : 'las plantillas activas'} y se activará al terminar. El pase de lista sigue con la versión actual mientras tanto. Puede tardar varios minutos.`}
                confirmLabel={enCurso ? 'Reconstruyendo...' : 'Reconstruir'}
                onConfirm={confirmar}
                onCancel={() => !enCurso && setAbierto(false)}
            >
                <Checkbox
                    className="mt-3"
                    label="Reconstrucción completa (reprocesa todas las fotos; tarda más)"
                    hint={dimensionNoCoincide ? 'Recomendada ahora: la dimensión del índice no coincide con la configurada.' : 'Solo hace falta si cambió el modelo o la dimensión del vector.'}
                    checked={completa}
                    disabled={enCurso}
                    onChange={(e) => setCompleta(e.target.checked)}
                />
                {enCurso && <p className="mt-2 flex items-center gap-2 text-sm"><Spinner size="sm" label="Reconstruyendo" /> Reconstruyendo, no cierre esta ventana...</p>}
            </ConfirmDialog>
        </div>
    );
}
