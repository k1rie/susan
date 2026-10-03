'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { abrirSesion } from '@/lib/api/sesiones.js';

const hhmm = (h) => (h ? String(h).slice(0, 5) : '-');

// Sesiones de hoy (P-02). Abrir/Ver monitor solo si el servidor la marca 'abrible' (RN-06).
export default function SesionesHoy({ sesiones = [] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [abriendo, setAbriendo] = useState(null);

    const abrir = async (s) => {
        setAbriendo(s.id_sesion);
        try {
            await abrirSesion({ idSesion: s.id_sesion });
            router.push(`/docente/sesiones/${s.id_sesion}`);
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo abrir la sesión', message: e.message });
            setAbriendo(null);
        }
    };

    return (
        <Card title="Sesiones de hoy">
            {sesiones.length === 0 ? (
                <EmptyState title="Sin sesiones hoy" description="No tienes clases programadas para el día de hoy." />
            ) : (
                <ul className="flex flex-col gap-3">
                    {sesiones.map((s) => (
                        <li key={s.id_sesion} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="font-medium">
                                    {s.materia} ({s.clave_grupo})
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {hhmm(s.hora_inicio)} - {hhmm(s.hora_fin)} · Aula {s.aula} · {s.camaras_activas} cámaras activas
                                </p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <StatusChip kind="sesion" value={s.estatus} size="sm" />
                                    <StatusChip kind="modo" value={s.modo_previsto} size="sm" title="Modo de registro previsto" />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {s.estatus === 'programada' && s.abrible && (
                                    <Button onClick={() => abrir(s)} loading={abriendo === s.id_sesion} disabled={abriendo != null}>
                                        Abrir sesión
                                    </Button>
                                )}
                                {s.estatus === 'abierta' && s.abrible && <Button href={`/docente/sesiones/${s.id_sesion}`}>Ver monitor</Button>}
                                {(s.estatus === 'cerrada' || s.estatus === 'suspendida') && (
                                    <Button variant="secondary" href={`/docente/sesiones/${s.id_sesion}`}>
                                        Ver sesión
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
