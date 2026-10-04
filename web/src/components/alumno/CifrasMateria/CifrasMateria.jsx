import clsx from 'clsx';
import { CircleCheck, Clock, FileCheck, Hourglass, Shield, ShieldAlert, ShieldCheck, ShieldX, UserX } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { nombreMateria } from '../alumno.utils.js';
import { cifrasMateria } from './cifrasMateria.utils.js';

const ICONOS = { presentes: CircleCheck, retardos: Clock, ausencias: UserX, justificadas: FileCheck, pendientes: Hourglass };
// El escudo de «Faltas restantes» cambia de forma con el estado (no solo de color): íntegro, con aviso o roto.
const ICONO_RESTANTES = { success: ShieldCheck, warning: ShieldAlert, danger: ShieldX, neutral: Shield };

// Casillas compactas con las cifras de la materia elegida (referencia: las casillas de «Listening Stats» de Mobbin): van entre la tarjeta
// principal de asistencia y el calendario. Dos columnas en el teléfono, tres desde ~512 px y seis desde 960 px de ANCHO DE LA SECCIÓN
// (container query: no depende de la pantalla). Seis columnas más angostas cortarían «Justificadas» (la etiqueta mide ~70 px y la
// casilla le deja el ancho menos 70 px de relleno e icono), por eso el salto a seis es tan tardío.
//   item = una fila de `api_alumno_resumen` (la de la materia elegida)
export default function CifrasMateria({ item, className }) {
    if (!item) return null;
    const nombre = nombreMateria(item.materia);
    return (
        <div className={clsx('@container', className)}>
            <div role="group" aria-label={nombre ? `Cifras de ${nombre}` : 'Cifras de la materia'} className="grid grid-cols-2 gap-3 @min-[32rem]:grid-cols-3 @min-[60rem]:grid-cols-6">
                {cifrasMateria(item).map((c) => (
                    <StatCard
                        key={c.clave}
                        label={c.label}
                        value={c.value}
                        hint={c.hint}
                        tone={c.tone}
                        icon={c.clave === 'restantes' ? ICONO_RESTANTES[c.tone] ?? Shield : ICONOS[c.clave]}
                        animated={typeof c.value === 'number'}
                    />
                ))}
            </div>
        </div>
    );
}
