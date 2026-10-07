'use client';

import { Camera } from 'lucide-react';
import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import { useApiQuery } from '@/hooks/data';
import { aulaObtener } from '@/lib/api/admin.js';
import { etiquetaEdificio } from '../compartido/grupos.utils.js';
import { useAvisarSucio } from '../compartido/useAvisarSucio.js';
import CamaraForm from '../CamaraForm';
import CamaraPanel from '../CamaraPanel';
import { etiquetaPosicion } from '../CamaraForm/camaraForm.utils.js';
import CapacidadForm from '../CapacidadForm';

const POSICIONES = ['frente', 'fondo'];

// P-09 pestaña Aula y cámaras: capacidad del aula y cámaras frente/fondo (ip | navegador). Una cámara existente se edita en su tarjeta; una
// posición sin cámara ofrece «Agregar» (panel lateral). `inscritosActivos` (del grupo) fija el piso de la capacidad. `onSucioChange` suma
// los cambios sin guardar de los tres formularios para que el detalle pregunte antes de cambiar de pestaña.
export default function AulaCamaras({ idAula, inscritosActivos, onChanged, onSucioChange }) {
    const consulta = useApiQuery(aulaObtener, { idAula });
    const [sucios, setSucios] = useState({});
    const [panel, setPanel] = useState(null);
    useAvisarSucio(Object.values(sucios).some(Boolean), onSucioChange);

    const marcar = (clave) => (valor) => setSucios((s) => (s[clave] === valor ? s : { ...s, [clave]: valor }));
    const recargar = async () => {
        await consulta.refetch();
        onChanged?.();
    };

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
            {(aula) => {
                const activas = (aula.camaras ?? []).filter((c) => c.estatus === 'activa').length;
                return (
                    <div className="grid gap-4">
                        <Card title={`Aula ${aula.clave}${aula.edificio ? ` · ${etiquetaEdificio(aula.edificio)}` : ''}`}>
                            <CapacidadForm aula={aula} inscritosActivos={inscritosActivos} onSaved={recargar} onSucioChange={marcar('capacidad')} />
                        </Card>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold tracking-tight">Cámaras del aula</h2>
                            <Badge tone={activas > 0 ? 'success' : 'warning'}>{activas > 0 ? 'Pase de lista automático' : 'Pase de lista manual'}</Badge>
                            <p className="w-full text-sm text-muted-foreground">
                                {activas > 0 ? 'Hay al menos una cámara activa: el pase de lista se hace con cámara.' : 'Sin una cámara activa, el docente pasa lista a mano.'}
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {POSICIONES.map((pos) => {
                                const camara = (aula.camaras ?? []).find((c) => c.posicion === pos);
                                return (
                                    <Card key={pos}>
                                        {camara ? (
                                            <CamaraForm idAula={aula.id_aula} posicion={pos} camara={camara} onSaved={recargar} onSucioChange={marcar(pos)} />
                                        ) : (
                                            <div className="flex flex-col items-start gap-3">
                                                <h3 className="font-medium">{etiquetaPosicion(pos)}</h3>
                                                <p className="text-sm text-muted-foreground">Sin cámara configurada en esta posición.</p>
                                                <Button variant="secondary" icon={<Camera aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={() => setPanel(pos)}>
                                                    Agregar cámara de {pos}
                                                </Button>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                        <CamaraPanel open={panel != null} idAula={aula.id_aula} posicion={panel ?? 'frente'} onClose={() => setPanel(null)} onSaved={recargar} />
                    </div>
                );
            }}
        </DataState>
    );
}
