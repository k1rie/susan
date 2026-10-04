'use client';

import { Camera, ImageOff, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { camarasEstado, camaraCambiarEstatus } from '@/lib/api/biometria.js';
import { useApiQuery, useApiMutation } from '@/hooks/data';
import Alert from '@/components/ui/Alert';
import BarrasPildora from '@/components/ui/BarrasPildora';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import Detalles from '@/components/ui/Detalles';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import StatusChip from '@/components/ui/StatusChip';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { useToast } from '@/components/ui/Toast';
import {
    CONFIG_CAPTURAS,
    ESTATUS_CAMARA,
    contadoresCamaras,
    datosCapturas,
    haceCuanto,
    mensajeCambio,
    resumenCapturas,
    sinCapturar,
} from './camaras.utils.js';

const ARGS = { limit: 200 };

// `soloLectura` (administrador): sin selector para cambiar el estatus; la base lo niega de todos modos.
export default function CamarasEstado({ soloLectura = false }) {
    const q = useApiQuery(camarasEstado, ARGS, { refetchInterval: 30000 });
    const cambiar = useApiMutation(camaraCambiarEstatus);
    const { toast } = useToast();
    const [pendiente, setPendiente] = useState(null); // { camara, estatus }
    const [avisos, setAvisos] = useState([]);

    const confirmar = async () => {
        try {
            const r = await cambiar.run({ idCamara: pendiente.camara.id_camara, estatus: pendiente.estatus });
            setAvisos(r?.advertencias ?? []);
            toast({ tone: 'success', title: 'Estatus actualizado' });
            setPendiente(null);
            q.refetch();
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo cambiar el estatus', message: e.message });
            throw e;
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {avisos.length > 0 && (
                <Alert tone="warning" title="Advertencias" onClose={() => setAvisos([])}>
                    <ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
                </Alert>
            )}
            <DataState
                loading={q.loading}
                error={q.error}
                data={q.data}
                onRetry={q.refetch}
                isEmpty={(d) => !d.items?.length}
                empty={<EmptyState title="No hay cámaras registradas." />}
            >
                {(d) => {
                    const n = contadoresCamaras(d.items);
                    const capturas = datosCapturas(d.items);
                    return (
                        <>
                            {/* A 360 px tres columnas dejaban ~70 px útiles y las etiquetas se partían: dos arriba y la tercera a todo el ancho.
                                Activas se lee frente al total («5 / 6»); sin ninguna activa deja de pintarse en verde. Las tres llevan apoyo para que las cifras
                                queden a la misma altura en la fila. */}
                            <section aria-label="Resumen de cámaras" className="grid grid-cols-2 gap-2 sm:gap-3 min-[520px]:grid-cols-3">
                                <StatCard animated icon={Camera} label="Activas" value={n.activas} unit={`/ ${n.total}`} tone={n.activas > 0 ? 'success' : 'neutral'} hint="En operación" />
                                <StatCard animated icon={VideoOff} label="Inactivas" value={n.inactivas} hint="Con mantenimiento" />
                                <StatCard animated icon={ImageOff} label="Sin capturas" value={n.sinCapturas} tone={n.sinCapturas > 0 ? 'warning' : 'neutral'} hint="Activas, 24 h" className="col-span-2 min-[520px]:col-span-1" />
                            </section>
                            <TarjetaGrafica
                                titulo="Capturas en 24 h por cámara"
                                resumen={resumenCapturas(capturas)}
                                pie={capturas.omitidas > 0 ? `Se muestran las ${capturas.filas.length} con más capturas; todas están abajo.` : undefined}
                            >
                                <BarrasPildora
                                    horizontal
                                    datos={capturas.filas}
                                    ejeX="camara"
                                    series={[{ clave: 'capturas' }]}
                                    config={CONFIG_CAPTURAS}
                                />
                            </TarjetaGrafica>
                            <ul className="grid gap-3 md:grid-cols-2">
                                {d.items.map((c) => (
                                    <li key={c.id_camara}>
                                        <Card
                                            title={`Aula ${c.aula_clave} · ${c.posicion}`}
                                            actions={<StatusChip kind="camara" value={c.estatus} />}
                                            padded={false}
                                            className="h-full overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
                                                <dl className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">Última captura</dt>
                                                        <dd className="font-medium">{haceCuanto(c.ultima_captura)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">Capturas 24 h</dt>
                                                        <dd className="font-medium tabular-nums">{c.capturas_24h}</dd>
                                                    </div>
                                                </dl>
                                                {c.sesion_abierta && <p className="text-sm font-medium">Sesión abierta en el aula</p>}
                                                {sinCapturar(c) && (
                                                    <Alert tone="warning">Sin capturas en 24 h: revise la conexión.</Alert>
                                                )}
                                                {!soloLectura && (
                                                    <label className="block text-sm">
                                                        <span className="mb-1 block text-xs text-muted-foreground">Cambiar estatus</span>
                                                        <Select
                                                            aria-label={`Estatus de la cámara ${c.aula_clave} ${c.posicion}`}
                                                            value={c.estatus}
                                                            options={ESTATUS_CAMARA}
                                                            onChange={(e) => e.target.value !== c.estatus && setPendiente({ camara: c, estatus: e.target.value })}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                            <div className="border-t border-border">
                                                <Detalles titulo="Más datos" resumen={`${c.edificio} · ${c.tipo}`} className="!rounded-none !border-0">
                                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                                        <dt className="text-muted-foreground">Edificio</dt><dd>{c.edificio}</dd>
                                                        <dt className="text-muted-foreground">Tipo</dt><dd>{c.tipo}</dd>
                                                        {c.direccion_ip && (<><dt className="text-muted-foreground">IP</dt><dd className="break-all">{c.direccion_ip}</dd></>)}
                                                    </dl>
                                                </Detalles>
                                            </div>
                                        </Card>
                                    </li>
                                ))}
                            </ul>
                        </>
                    );
                }}
            </DataState>
            <ConfirmDialog
                open={Boolean(pendiente)}
                title="Cambiar estatus de la cámara"
                message={pendiente ? mensajeCambio(pendiente.camara, pendiente.estatus) : ''}
                confirmLabel="Cambiar"
                onConfirm={confirmar}
                onCancel={() => setPendiente(null)}
            />
        </div>
    );
}
