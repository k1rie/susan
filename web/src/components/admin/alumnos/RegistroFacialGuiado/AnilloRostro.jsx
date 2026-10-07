import clsx from 'clsx';
import { claseMarca, MARCAS_ANILLO, tieneDireccion } from './registroGuiado.utils.js';

// Visor circular rodeado por un aro de 60 marcas (como el de Face ID). Las marcas RESALTADAS señalan hacia dónde mirar: el arco
// del lado izquierdo, derecho o de arriba según el paso, y el aro completo cuando no hay dirección (de frente, otra expresión).
// Todo es decorativo (aria-hidden): la indicación también va en texto y en la flecha dentro del visor.
//   clave    -> clave del paso (frente, izquierda, derecha, arriba, variacion); null = sin dirección (portada, guardado, listo)
//   estado   -> estado de lo resaltado: actual | verificando | hecho | error | pendiente
//   progreso -> 0..1: avance de la toma en curso (aciertos seguidos); llena en azul lo resaltado
//   entrada  -> las marcas se encienden en cascada al montar (portada del asistente)
//   tamano   -> clases de ancho; el visor es cuadrado y el contenido se recorta en círculo
export default function AnilloRostro({ clave = null, estado = 'pendiente', progreso = 0, entrada = false, tamano = 'w-[min(84vw,44dvh,22rem)]', className, children }) {
    const direccion = tieneDireccion(clave);
    return (
        <div className={clsx('relative mx-auto aspect-square shrink-0', tamano, className)}>
            <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
                {MARCAS_ANILLO.map((m) => {
                    const clase = claseMarca(m, { clave, estado, progreso });
                    const resaltada = direccion && !clase.includes('opacity-60');
                    return (
                        <line
                            key={m.indice}
                            x1={resaltada ? m.x1f : m.x1}
                            y1={resaltada ? m.y1f : m.y1}
                            x2={m.x2}
                            y2={m.y2}
                            strokeWidth={resaltada ? '3.6' : '3'}
                            strokeLinecap="round"
                            className={clsx('transition-[stroke] duration-300', clase)}
                            style={entrada ? { animation: 'registro-marca-entra 320ms ease-out both', animationDelay: `${m.indice * 12}ms` } : undefined}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-[8%] overflow-hidden rounded-full bg-muted">{children}</div>
        </div>
    );
}
