'use client';

import { CalendarClock, CircleCheck, CirclePause, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import TarjetaFila from '@/components/ui/TarjetaFila';
import { useToast } from '@/components/ui/Toast';
import { abrirSesion } from '@/lib/api/sesiones.js';

const hhmm = (h) => (h ? String(h).slice(0, 5) : '-');
// Icono y color de la ficha según el estado de la sesión (Lucide).
const FICHA = {
    abierta: { icono: Radio, tono: 'verde' },
    programada: { icono: CalendarClock, tono: 'azul' },
    cerrada: { icono: CircleCheck, tono: 'neutro' },
    suspendida: { icono: CirclePause, tono: 'dorado' },
};

// Sesiones de hoy (P-02): una tarjeta de fila por sesión. Abrir/Ver monitor solo si el servidor la marca 'abrible' (RN-06).
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
        <section aria-labelledby="t-sesiones-hoy">
            <h2 id="t-sesiones-hoy" className="mb-4 text-xl font-semibold tracking-tight">Sesiones de hoy</h2>
            {sesiones.length === 0 ? (
                <EmptyState title="Sin sesiones hoy" description="No tienes clases programadas hoy." />
            ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {sesiones.map((s) => {
                        const ficha = FICHA[s.estatus] ?? FICHA.programada;
                        return (
                            <li key={s.id_sesion}>
                                <TarjetaFila
                                    icono={ficha.icono}
                                    tono={ficha.tono}
                                    titulo={`${s.materia} (${s.clave_grupo})`}
                                    subtitulo={`${hhmm(s.hora_inicio)} - ${hhmm(s.hora_fin)} · Aula ${s.aula} · ${s.camaras_activas} cám.`}
                                    className="h-full flex-wrap sm:flex-nowrap"
                                    accion={
                                        <div className="flex flex-wrap gap-2">
                                            {s.estatus === 'programada' && s.abrible && (
                                                <Button size="sm" onClick={() => abrir(s)} loading={abriendo === s.id_sesion} disabled={abriendo != null}>
                                                    Abrir sesión
                                                </Button>
                                            )}
                                            {s.estatus === 'abierta' && s.abrible && <Button size="sm" href={`/docente/sesiones/${s.id_sesion}`}>Ver monitor</Button>}
                                            {(s.estatus === 'cerrada' || s.estatus === 'suspendida') && (
                                                <Button size="sm" variant="secondary" href={`/docente/sesiones/${s.id_sesion}`}>
                                                    Ver sesión
                                                </Button>
                                            )}
                                        </div>
                                    }
                                >
                                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                                        <StatusChip kind="sesion" value={s.estatus} size="sm" />
                                        <StatusChip kind="modo" value={s.modo_previsto} size="sm" title="Modo de registro previsto" />
                                    </span>
                                </TarjetaFila>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
