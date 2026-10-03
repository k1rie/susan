import Avatar from '@/components/ui/Avatar';
import StatusChip from '@/components/ui/StatusChip';

// Escenas del panel de producto. Nombres FICTICIOS (nunca datos reales). Cada escena es un componente sin estado cuya
// animación es CSS de un solo uso (clases escena-* de globals.css, con el retardo en la variable --d).

const ALUMNOS = ['Ana Ruiz López', 'Luis Mena Díaz', 'Sofía Pérez Gil', 'Diego Cruz Vera', 'Marta Solís Paz'];

function VistaLista() {
    return (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-lift">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold">Matemáticas Financieras · 5C</p>
                    <p className="text-xs text-muted-foreground">Aula B-04 · 09:00 - 10:00</p>
                </div>
                <StatusChip kind="sesion" value="abierta" size="sm" />
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="escena-barra-x h-full w-full rounded-full bg-presente" style={{ '--d': '0.4s' }} />
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
                {ALUMNOS.map((nombre, i) => (
                    <li key={nombre} className="escena-entra flex items-center gap-3" style={{ '--d': `${0.15 + i * 0.12}s` }}>
                        <Avatar nombre={nombre} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{nombre}</span>
                        <span className="relative flex h-7 w-24 items-center justify-end">
                            <span className="escena-chip-sale absolute right-0" style={{ '--d': `${1 + i * 0.45}s` }}>
                                <StatusChip kind="asistencia" value="pendiente" size="sm" />
                            </span>
                            <span className="escena-chip-entra absolute right-0" style={{ '--d': `${1 + i * 0.45}s` }}>
                                <StatusChip kind="asistencia" value={i === 3 ? 'retardo' : 'presente'} size="sm" />
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const SEMANAS = [8, 11, 9, 14, 18, 23];

function VistaRiesgo() {
    const max = 30;
    const ancho = 300;
    const alto = 150;
    const paso = ancho / SEMANAS.length;
    const y = (v) => alto - (v / max) * (alto - 10) - 4;
    const puntos = SEMANAS.map((v, i) => `${i === 0 ? 'M' : 'L'}${(paso * i + paso / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    return (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-lift">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Faltas acumuladas · 3A</p>
                <span className="escena-entra rounded-full bg-ausente-bg px-2.5 py-0.5 text-xs font-medium text-ausente" style={{ '--d': '3.2s' }}>Riesgo alto</span>
            </div>
            <svg viewBox={`0 0 ${ancho} ${alto}`} className="mt-4 w-full" role="presentation">
                {SEMANAS.map((v, i) => (
                    <rect key={i} x={paso * i + 8} y={y(v)} width={paso - 16} height={alto - 4 - y(v)} rx="6" fill="var(--primary)" opacity="0.18" className="escena-barra-y" style={{ '--d': `${0.1 + i * 0.12}s` }} />
                ))}
                <line x1="0" x2={ancho} y1={y(20)} y2={y(20)} stroke="var(--destructive)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                <path d={puntos} pathLength="1" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="escena-trazo" style={{ '--d': '0.9s' }} />
            </svg>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Semana 1</span>
                <span className="text-destructive">Límite 20 %</span>
                <span>Semana 6</span>
            </div>
        </div>
    );
}

const MATERIAS = [
    { nombre: 'Administración Financiera', usado: 0.34, tono: 'bg-presente', texto: '3 de 9 faltas permitidas' },
    { nombre: 'Matemáticas Financieras', usado: 0.78, tono: 'bg-retardo', texto: '7 de 9 faltas permitidas' },
    { nombre: 'Contabilidad de Costos', usado: 0.11, tono: 'bg-presente', texto: '1 de 9 faltas permitidas' },
];

function VistaHistorial() {
    return (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-lift">
            <div className="flex items-center gap-3">
                <Avatar nombre="Ana Ruiz López" size="md" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Mi asistencia</p>
                    <p className="text-xs text-muted-foreground">Periodo 2026-2</p>
                </div>
                <StatusChip kind="justificante" value="aprobado" size="sm" />
            </div>
            <ul className="mt-5 flex flex-col gap-4">
                {MATERIAS.map((m, i) => (
                    <li key={m.nombre} className="escena-entra" style={{ '--d': `${0.1 + i * 0.15}s` }}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{m.nombre}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{m.texto}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                            <div className={`escena-barra-x h-full rounded-full ${m.tono}`} style={{ width: `${m.usado * 100}%`, '--d': `${0.4 + i * 0.2}s` }} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export const ESCENAS = [
    { id: 'lista', titulo: 'Pasa lista en segundos', texto: 'La cámara reconoce a cada alumno y SUSAN registra la asistencia por ti.', Vista: VistaLista },
    { id: 'riesgo', titulo: 'Detecta el ausentismo a tiempo', texto: 'Tendencia y proyección con métodos numéricos, antes de que sea tarde.', Vista: VistaRiesgo },
    { id: 'historial', titulo: 'Tu historial, siempre contigo', texto: 'Cada alumno ve sus faltas, su límite para examen y sus justificantes.', Vista: VistaHistorial },
];
