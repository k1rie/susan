'use client';

import { Check, CircleCheck } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { textoFotos } from '../PlantillaFacialPanel/plantillaFacial.utils.js';
import AnilloRostro from './AnilloRostro.jsx';
import { Cuerpo, Pie } from './Estructura.jsx';

// Guardando: el servicio promedia las tomas y reconstruye el índice, lo que puede tardar hasta un minuto.
export function PantallaGuardando({ total }) {
    return (
        <>
            <Cuerpo>
                <div className="flex flex-col items-center gap-5 py-2 text-center">
                    <AnilloRostro estado="verificando">
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Spinner size="lg" label="Guardando el registro facial" />
                        </div>
                    </AnilloRostro>
                    <div role="status" className="flex flex-col gap-1.5">
                        <h2 className="text-xl font-semibold tracking-tight">Guardando el rostro…</h2>
                        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                            Subiendo {textoFotos(total)} y actualizando el índice. Puede tardar un minuto; no cierres esta ventana.
                        </p>
                    </div>
                </div>
            </Cuerpo>
            <Pie>
                <Button size="lg" fullWidth disabled loading>
                    Guardando
                </Button>
            </Pie>
        </>
    );
}

// Listo: la plantilla ya quedó guardada; el índice puede seguir actualizándose en segundo plano (el panel lo sondea).
export function PantallaListo({ registro, onTerminar }) {
    const indice = registro?.indice;
    return (
        <>
            <Cuerpo>
                <div className="flex flex-col items-center gap-5 py-2 text-center">
                    <AnilloRostro estado="hecho" entrada>
                        <div className="flex size-full items-center justify-center bg-presente-bg text-presente">
                            <Check aria-hidden="true" className="size-1/3 animate-in duration-500 fade-in-0 zoom-in-50" strokeWidth={1.75} />
                        </div>
                    </AnilloRostro>
                    <div role="status" className="flex flex-col items-center gap-1.5">
                        <h2 className="text-xl font-semibold tracking-tight">Rostro registrado</h2>
                        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                            Plantilla creada con {textoFotos(registro?.nFotos ?? 1)}. Ya se puede usar para pasar lista con la cámara.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 text-left">
                        {indice === 'lista' && (
                            <p className="flex items-center justify-center gap-2 text-sm text-presente">
                                <CircleCheck aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                                Índice listo{registro.version ? `, versión ${registro.version}` : ''}.
                            </p>
                        )}
                        {indice === 'indexando' && (
                            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Spinner size="sm" label="Indexando" />
                                Actualizando el índice en segundo plano…
                            </p>
                        )}
                        {indice === 'tardando' && (
                            <Alert tone="info" title="El índice tarda más de lo esperado">
                                Se sigue actualizando en segundo plano; vuelve a consultar más tarde.
                            </Alert>
                        )}
                        {indice === 'pendiente' && (
                            <Alert tone="warning" title="Plantilla guardada, índice pendiente">
                                La plantilla quedó guardada pero el índice no se pudo actualizar; pide a un técnico que lo reconstruya.
                            </Alert>
                        )}
                        {registro?.descartadas > 0 && (
                            <Alert tone="warning">
                                El índice descartó {registro.descartadas} {registro.descartadas === 1 ? 'foto' : 'fotos'} al promediar; revisa la consistencia.
                            </Alert>
                        )}
                    </div>
                </div>
            </Cuerpo>
            <Pie>
                <Button size="lg" fullWidth onClick={onTerminar}>
                    Terminar
                </Button>
            </Pie>
        </>
    );
}
