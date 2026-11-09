'use client';

import { RotateCcw, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import PanelLateral from '@/components/ui/PanelLateral';
import CampoPregunta from '../CampoPregunta';
import ConversacionAsistente from '../ConversacionAsistente';
import { SUGERENCIAS_DOCENTE, mostrarBotonEn } from './asistenteIA.utils.js';
import { useAsistenteIA } from './useAsistenteIA.js';

// Asistente de IA del docente: botón flotante que abre un panel lateral (pantalla completa en teléfono) con un chat sobre SUS datos
// (alumnos en riesgo, ausentismo por grupo, sesiones de hoy, justificantes). Las respuestas salen de POST /api/asistente.
// Posición: en teléfono queda por encima de la barra inferior Y de las barras de acciones pegadas de los formularios (FormActions
// 'movil', que llegan hasta ~10,5 rem), para no tapar «Guardar» ni el botón central «Pasar lista»; en escritorio, esquina inferior
// derecha. No se dibuja en el pase de lista ni en la sesión en vivo (sus acciones principales van abajo).
//   disponible: false si el servidor no tiene ANTHROPIC_API_KEY; el panel abre igual y explica por qué no responde.
export default function AsistenteIA({ disponible = true }) {
    const pathname = usePathname();
    const [abierto, setAbierto] = useState(false);
    const campo = useRef(null);
    const { mensajes, estado, consultando, ocupado, enviar, detener, reiniciar } = useAsistenteIA();

    if (!mostrarBotonEn(pathname) && !abierto) return null;

    return (
        <>
            {/* Sigue montado con el panel abierto: al cerrar, el foco vuelve aquí (useDialog). */}
            <button
                type="button"
                onClick={() => setAbierto(true)}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                className="fixed right-3 bottom-[calc(11rem+env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-foreground shadow-lift transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 lg:right-6 lg:bottom-6 lg:h-11 lg:w-auto lg:px-4"
            >
                <Sparkles aria-hidden="true" className="size-5 text-brand-gold" strokeWidth={1.75} />
                <span className="sr-only lg:not-sr-only lg:text-sm lg:font-medium">Asistente</span>
            </button>
            <PanelLateral
                open={abierto}
                onClose={() => setAbierto(false)}
                title="Asistente"
                description="Respuestas con los datos de tus grupos."
                size="sm"
                initialFocusRef={disponible ? campo : undefined}
                footer={
                    <div className="flex w-full flex-col gap-2">
                        <CampoPregunta ref={campo} onEnviar={enviar} onDetener={detener} ocupado={ocupado} deshabilitado={!disponible} />
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] text-muted-foreground">Puede equivocarse: verifica en Reportes antes de decidir.</p>
                            {mensajes.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={reiniciar}
                                    icon={<RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
                                    className="shrink-0"
                                >
                                    Nueva
                                </Button>
                            )}
                        </div>
                    </div>
                }
            >
                <ConversacionAsistente
                    mensajes={mensajes}
                    estado={estado}
                    consultando={consultando}
                    disponible={disponible}
                    sugerencias={SUGERENCIAS_DOCENTE}
                    onSugerencia={enviar}
                />
            </PanelLateral>
        </>
    );
}
