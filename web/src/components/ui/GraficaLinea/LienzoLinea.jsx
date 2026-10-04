'use client';

import { useId } from 'react';
import { FUENTE } from './graficaLinea.utils.js';

// Fotogramas de entrada (se inyectan con el lienzo; las animaciones no tienen estado de React): una serie que se monta después, p. ej.
// una media móvil que se marca, arranca su propia animación sin reiniciar las demás, y cambiar los datos solo cambia atributos.
// Solo stroke-dashoffset (líneas), opacity y transform (puntos, bandas).
const FOTOGRAMAS = `
@keyframes gl-dibujar { 0% { stroke-dashoffset: 1; opacity: 0; } 1% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
@keyframes gl-aparecer { from { opacity: 0; } to { opacity: 1; } }
@keyframes gl-brotar { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
`;

const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Estilo de una animación de entrada: en pausa (en su primer fotograma, oculta) hasta que la gráfica entra en vista. Con "reducir
// movimiento" (`animar` false) no hay animación y se ve el estado final de inmediato.
function entrada({ nombre, duracion, retraso = 0, animar, correr }) {
    if (!animar) return undefined;
    return {
        animationName: nombre,
        animationDuration: `${duracion}s`,
        animationTimingFunction: CURVA,
        animationDelay: `${retraso}s`,
        animationFillMode: 'both',
        animationPlayState: correr ? 'running' : 'paused',
    };
}

// Lienzo SVG en píxeles reales (sin viewBox: el texto no se deforma): cuadrícula suave, ejes con marcas, límite, marca vertical,
// bandas, líneas, puntos y, sobre la fila activa, guía vertical y puntos resaltados. Decorativo (aria-hidden): los datos se anuncian
// por la región aria-live del contenedor y por el resumen de la tarjeta.
export default function LienzoLinea({ modelo, activo, correr, animar }) {
    const id = useId();
    const { ancho, alto, izq, der, arriba, abajo, series, marcasX, marcasY, limite, marca, xIni, xFin } = modelo;
    const bandas = series.filter((s) => s.tipo === 'banda');
    const lineas = series.filter((s) => s.tipo === 'linea');
    const puntos = series.filter((s) => s.tipo === 'puntos');
    const retrasoPorX = (x) => 0.2 + ((x - xIni) / Math.max(1, xFin - xIni)) * 0.8;
    const xActiva = activo === null ? null : modelo.posiciones[activo];

    return (
        <>
            <style>{FOTOGRAMAS}</style>
            <svg width={ancho} height={alto} className="pointer-events-none absolute inset-0 block overflow-visible" aria-hidden="true" focusable="false">
                {/* Cuadrícula: solo líneas horizontales muy suaves, sin ejes. */}
                {marcasY.map((m) => (
                    <line key={m.valor} x1={izq} x2={der} y1={m.y} y2={m.y} className="stroke-border" strokeOpacity={0.8} strokeWidth={1} shapeRendering="crispEdges" />
                ))}
                {marcasY.map((m) => (
                    <text key={m.valor} x={izq - 8} y={m.y} dy="0.32em" textAnchor="end" className="fill-muted-foreground tabular-nums" style={{ fontSize: FUENTE }}>{m.texto}</text>
                ))}
                {marcasX.map((m) => (
                    <text key={m.valor} x={m.x} y={abajo + 18} textAnchor="middle" className="fill-muted-foreground tabular-nums" style={{ fontSize: FUENTE }}>{m.texto}</text>
                ))}

                {limite && <line x1={izq} x2={der} y1={limite.y} y2={limite.y} className="stroke-destructive" strokeOpacity={0.75} strokeWidth={1.25} strokeDasharray="4 4" />}
                {marca && <line x1={marca.x} x2={marca.x} y1={arriba} y2={abajo} className="stroke-destructive" strokeOpacity={0.55} strokeWidth={1.25} />}
                {xActiva !== null && <line data-guia="" x1={xActiva} x2={xActiva} y1={arriba} y2={abajo} className="stroke-muted-foreground" strokeOpacity={0.55} strokeWidth={1} />}

                {/* Bandas (debajo de todo): degradado suave entre el borde inferior y el superior. */}
                {bandas.map((s) => {
                    if (s.puntos.length === 1) {
                        const [p] = s.puntos;
                        return <line key={s.clave} x1={p.x} x2={p.x} y1={p.ySup} y2={p.yInf} stroke={s.color} strokeWidth={6} strokeLinecap="round" strokeOpacity={0.25} style={entrada({ nombre: 'gl-aparecer', duracion: 0.8, retraso: 0.3, animar, correr })} />;
                    }
                    if (!s.trazo) return null;
                    return (
                        <g key={s.clave}>
                            <linearGradient id={`${id}-b${s.orden}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity={0.34} />
                                <stop offset="100%" stopColor={s.color} stopOpacity={0.1} />
                            </linearGradient>
                            <path data-serie={s.clave} d={s.trazo} fill={`url(#${id}-b${s.orden})`} stroke="none" style={entrada({ nombre: 'gl-aparecer', duracion: 0.8, retraso: 0.3, animar, correr })} />
                        </g>
                    );
                })}

                {/* Líneas rectas entre puntos (una línea quebrada es exacta: no se suaviza). Se dibujan con pathLength=1 y stroke-dashoffset. */}
                {lineas.map((s) => {
                    if (s.puntos.length === 0) return null;
                    if (s.puntos.length === 1) {
                        const [p] = s.puntos;
                        return <circle key={s.clave} data-serie={s.clave} cx={p.x} cy={p.y} r={s.grosor * 1.75} fill={s.color} style={{ transformBox: 'fill-box', transformOrigin: 'center', ...entrada({ nombre: 'gl-brotar', duracion: 0.45, retraso: 0.3, animar, correr }) }} />;
                    }
                    const dibujo = entrada({ nombre: 'gl-dibujar', duracion: 1.2, retraso: 0.05, animar, correr });
                    if (s.discontinua) {
                        // Un trazo discontinuo no se puede "dibujar" con dashoffset (los guiones ya usan el dasharray): se revela con una máscara
                        // cuyo trazo sólido sí se dibuja. La máscara es de luminancia: el blanco significa "visible", no es un color de la interfaz.
                        const idMascara = `${id}-m${s.orden}`;
                        return (
                            <g key={s.clave}>
                                {animar && (
                                    <mask id={idMascara} maskUnits="userSpaceOnUse" x={0} y={0} width={ancho} height={alto}>
                                        <path d={s.trazo} fill="none" stroke="white" strokeWidth={s.grosor + 6} pathLength={1} strokeDasharray={1} style={dibujo} />
                                    </mask>
                                )}
                                <path data-serie={s.clave} d={s.trazo} fill="none" stroke={s.color} strokeWidth={s.grosor} strokeDasharray="6 4" strokeLinejoin="round" mask={animar ? `url(#${idMascara})` : undefined} />
                            </g>
                        );
                    }
                    return (
                        <path
                            key={s.clave}
                            data-serie={s.clave}
                            d={s.trazo}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={s.grosor}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength={animar ? 1 : undefined}
                            strokeDasharray={animar ? 1 : undefined}
                            style={dibujo}
                        />
                    );
                })}

                {/* Puntos con aro del color de la tarjeta (se separan de la línea y de la banda que cruzan). */}
                {puntos.map((s) => s.puntos.map((p) => (
                    <circle
                        key={`${s.clave}-${p.indice}`}
                        data-serie={s.clave}
                        cx={p.x}
                        cy={p.y}
                        r={s.grosor}
                        fill={s.color}
                        stroke="var(--card)"
                        strokeWidth={2}
                        style={{ transformBox: 'fill-box', transformOrigin: 'center', ...entrada({ nombre: 'gl-brotar', duracion: 0.45, retraso: retrasoPorX(p.x), animar, correr }) }}
                    />
                )))}

                {/* Fila activa: resalta el valor de cada serie en esa x (los puntos al final, para que queden sobre las líneas). */}
                {activo !== null && [...bandas, ...lineas, ...puntos].map((s) => {
                    const p = s.puntos.find((q) => q.indice === activo);
                    if (!p) return null;
                    if (s.tipo === 'banda') return <line key={s.clave} data-activo={s.clave} x1={p.x} x2={p.x} y1={p.ySup} y2={p.yInf} stroke={s.color} strokeWidth={4} strokeLinecap="round" strokeOpacity={0.5} />;
                    return <circle key={s.clave} data-activo={s.clave} cx={p.x} cy={p.y} r={s.tipo === 'puntos' ? s.grosor + 2 : 4.5} fill={s.color} stroke="var(--card)" strokeWidth={2.5} />;
                })}
            </svg>
        </>
    );
}
