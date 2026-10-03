'use client';

import { useState } from 'react';
import { camarasEstado, camaraCambiarEstatus } from '@/lib/api/biometria.js';
import { useApiQuery, useApiMutation } from '@/hooks/data';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { ESTATUS_CAMARA, haceCuanto, mensajeCambio, sinCapturar } from './camaras.utils.js';

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
        <div className="flex flex-col gap-3">
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
                {(d) => (
                    <ul className="grid gap-3 md:grid-cols-2">
                        {d.items.map((c) => (
                            <li key={c.id_camara}>
                                <Card title={`Aula ${c.aula_clave} · ${c.posicion}`} actions={<StatusChip kind="camara" value={c.estatus} />}>
                                    <dl className="grid grid-cols-2 gap-1 text-sm">
                                        <dt className="text-muted-foreground">Edificio</dt><dd>{c.edificio}</dd>
                                        <dt className="text-muted-foreground">Tipo</dt><dd>{c.tipo}</dd>
                                        {c.direccion_ip && (<><dt className="text-muted-foreground">IP</dt><dd>{c.direccion_ip}</dd></>)}
                                        <dt className="text-muted-foreground">Última captura</dt><dd>{haceCuanto(c.ultima_captura)}</dd>
                                        <dt className="text-muted-foreground">Capturas 24 h</dt><dd>{c.capturas_24h}</dd>
                                    </dl>
                                    {c.sesion_abierta && <p className="mt-2 text-sm font-medium">Sesión abierta en el aula</p>}
                                    {sinCapturar(c) && (
                                        <Alert tone="warning" className="mt-2">
                                            Cámara activa sin capturas en las últimas 24 h. Revise su conexión.
                                        </Alert>
                                    )}
                                    {!soloLectura && (
                                        <label className="mt-3 block text-sm">
                                            <span className="mb-1 block text-muted-foreground">Cambiar estatus</span>
                                            <Select
                                                aria-label={`Estatus de la cámara ${c.aula_clave} ${c.posicion}`}
                                                value={c.estatus}
                                                options={ESTATUS_CAMARA}
                                                onChange={(e) => e.target.value !== c.estatus && setPendiente({ camara: c, estatus: e.target.value })}
                                            />
                                        </label>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
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
