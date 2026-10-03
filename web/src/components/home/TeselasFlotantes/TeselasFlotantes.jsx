import { cn } from '@/lib/utils';

const COLOR = { azul: 'var(--primary)', dorado: 'var(--brand-gold)', verde: 'var(--presente)', violeta: 'var(--chart-5)' };

// Posiciones fijas (en %/rem) de las teselas; cada una deriva despacio (30-60 s) solo con transform. Decoración pura:
// aria-hidden, sin eventos, y oculta bajo lg (1024 px) para no recargar el teléfono.
const POSICIONES = [
    { cls: 'right-[4%] top-[10%] size-24', dur: '46s', ret: '0s', dx: '14px', dy: '-18px', rot: '-6deg' },
    { cls: 'right-[17%] top-[52%] size-20', dur: '38s', ret: '-6s', dx: '-10px', dy: '12px', rot: '5deg' },
    { cls: 'right-[3%] bottom-[8%] size-28', dur: '54s', ret: '-12s', dx: '10px', dy: '-12px', rot: '4deg' },
    { cls: 'right-[20%] top-[8%] size-14', dur: '42s', ret: '-3s', dx: '-8px', dy: '14px', rot: '-3deg' },
];

// `modulos` aporta icono y tono de cada tesela (los primeros 4 del rol).
export default function TeselasFlotantes({ modulos = [], className }) {
    return (
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 hidden overflow-hidden lg:block', className)}>
            {POSICIONES.map((p, i) => {
                const m = modulos[i % Math.max(modulos.length, 1)];
                const Icono = m?.icono;
                const color = COLOR[m?.tono] || COLOR.azul;
                return (
                    <div
                        key={p.cls}
                        className={cn('tesela-flota textura-grano absolute flex items-center justify-center overflow-hidden rounded-3xl shadow-soft', p.cls)}
                        style={{
                            '--dur': p.dur, '--ret': p.ret, '--dx': p.dx, '--dy': p.dy, '--rot': p.rot,
                            background: `linear-gradient(135deg, color-mix(in oklab, ${color} 12%, var(--card)), color-mix(in oklab, ${color} 38%, var(--card)))`,
                        }}
                    >
                        {Icono && <Icono className="size-1/2" strokeWidth={1.4} style={{ color }} />}
                    </div>
                );
            })}
        </div>
    );
}
