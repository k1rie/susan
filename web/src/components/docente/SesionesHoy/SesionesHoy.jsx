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
import { ANCLA_SESIONES_HOY, ETIQUETA_ACCION, hhmm, urlSesion } from '../pasarLista.utils.js';

// Icono y color de la ficha según el estado de la sesión (Lucide).
const FICHA = {
    abierta: { icono: Radio, tono: 'verde' },
    programada: { icono: CalendarClock, tono: 'azul' },
    cerrada: { icono: CircleCheck, tono: 'neutro' },
    suspendida: { icono: CirclePause, tono: 'dorado' },
};

// Apilado de la acción cuando no hay sitio. En TarjetaFila la columna de texto es flex-1 con base 0, así que por sí sola nunca "no cabe"
// y el wrap no se activa: el botón le quitaba ancho al título y al aula (lo esencial de la fila) a 360 px y también con dos columnas
// (md, tarjetas de ~360 px). Con un ancho mínimo de 13 rem en esa columna (cabe «Administración Financiera (3A)») y SIN volver a
// nowrap en pantallas grandes, cuando ya no caben ficha + texto + botón el botón baja a una segunda línea y el texto se lee completo; si
// hay sitio se queda en la misma línea. Bajo sm la acción se alinea con el texto (ml-14 = ficha 40 px + hueco 16 px). Los selectores
// apuntan a los hijos directos de TarjetaFila: la columna de texto (span.flex-1) y la acción (último span.shrink-0; el primero es la
// ficha del icono y no debe moverse). Si TarjetaFila cambia su marcado, ajustar aquí.
const CLASES_FILA = [
    'h-full flex-wrap',
    '[&>span.flex-1]:min-w-[13rem]',
    '[&>span.shrink-0:last-child]:max-sm:ml-14',
].join(' ');

// Lista completa de las sesiones de hoy (P-02), debajo de la tarjeta principal «Pasar lista» (PasarListaHero): una tarjeta de fila por
// sesión. El botón principal es «Pasar lista» (abierta, automática o manual) o «Abrir y pasar lista» (programada dentro de su
// horario: el servidor la marca 'abrible', RN-06). OJO: `abrible` es falso para una sesión ya abierta, así que NO se exige para
// «Pasar lista» (antes se exigía y la sesión abierta se quedaba sin botón). Ambos llevan a /docente/sesiones/<id>?pasar-lista=1.
export default function SesionesHoy({ sesiones = [] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [abriendo, setAbriendo] = useState(null);

    const abrir = async (s) => {
        setAbriendo(s.id_sesion);
        try {
            await abrirSesion({ idSesion: s.id_sesion });
            router.push(urlSesion(s.id_sesion, { pasarLista: true }));
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo abrir la sesión', message: e.message });
            setAbriendo(null);
        }
    };

    // Un solo botón por fila (o ninguno). Si no hay botón NO se pasa `accion` a TarjetaFila: un contenedor vacío igual sería un
    // elemento flex más y, con el wrap de abajo, bajaría de línea y estiraría la fila 16 px.
    const botonDe = (s) => {
        if (s.estatus === 'programada' && s.abrible) {
            return (
                <Button size="sm" onClick={() => abrir(s)} loading={abriendo === s.id_sesion} disabled={abriendo != null}>
                    {ETIQUETA_ACCION.abrible}
                </Button>
            );
        }
        if (s.estatus === 'abierta') return <Button size="sm" href={urlSesion(s.id_sesion, { pasarLista: true })}>Pasar lista</Button>;
        if (s.estatus === 'cerrada' || s.estatus === 'suspendida') {
            return (
                <Button size="sm" variant="secondary" href={urlSesion(s.id_sesion)}>
                    Ver sesión
                </Button>
            );
        }
        return null;
    };

    return (
        <section id={ANCLA_SESIONES_HOY} aria-labelledby="t-sesiones-hoy" className="scroll-mt-4">
            <h2 id="t-sesiones-hoy" className="mb-4 text-xl font-semibold tracking-tight">Todas las sesiones de hoy</h2>
            {sesiones.length === 0 ? (
                <EmptyState title="Sin sesiones hoy" description="No tienes clases programadas hoy." />
            ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {sesiones.map((s) => {
                        const ficha = FICHA[s.estatus] ?? FICHA.programada;
                        const boton = botonDe(s);
                        return (
                            <li key={s.id_sesion}>
                                <TarjetaFila
                                    icono={ficha.icono}
                                    tono={ficha.tono}
                                    titulo={`${s.materia} (${s.clave_grupo})`}
                                    subtitulo={`${hhmm(s.hora_inicio)} - ${hhmm(s.hora_fin)} · Aula ${s.aula} · ${s.camaras_activas} cám.`}
                                    className={CLASES_FILA}
                                    accion={boton && <div className="flex flex-wrap gap-2">{boton}</div>}
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
