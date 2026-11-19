'use client';

import { useRef } from 'react';
import Button from '@/components/ui/Button';
import SubidaFotosPlantilla from '../SubidaFotosPlantilla';
import { textoContador } from '../PlantillaFacialPanel/plantillaFacial.utils.js';
import { Cuerpo, Pie } from './Estructura.jsx';

// Camino alterno al de la cámara: subir de 3 a 8 fotos ya tomadas del mismo alumno. Después se revisan igual que las de cámara.
export default function PantallaArchivo({ p, onVolver, onContinuar }) {
    const botonRef = useRef(null);
    const total = p.tomas.length;
    const marcadas = p.tomas.filter((t) => t.estado !== 'aceptada' && t.estado !== 'verificando').length;
    const texto = total === 0 ? `Sube al menos ${p.minimo} fotos.` : textoContador({ total, aceptadas: p.aceptadas, marcadas, minimo: p.minimo });
    const verificando = p.tomas.some((t) => t.estado === 'verificando');
    return (
        <>
            <Cuerpo centrado={false}>
                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-semibold tracking-tight">Subir fotos</h2>
                        <p className="text-sm text-muted-foreground">De frente y bien iluminadas; varía el ángulo, la expresión o la luz.</p>
                    </div>
                    <SubidaFotosPlantilla
                        tomas={p.tomas}
                        minimo={p.minimo}
                        maximo={p.maximo}
                        onAgregar={(blob, { nombre }) => p.agregarToma(blob, 'archivo', { nombre })}
                        onQuitar={p.quitarToma}
                        botonRef={botonRef}
                    />
                    <p className="text-sm">{texto}</p>
                </div>
            </Cuerpo>
            <Pie>
                <Button size="lg" fullWidth onClick={onContinuar} disabled={total < p.minimo} loading={verificando}>
                    Revisar fotos
                </Button>
                <Button variant="ghost" fullWidth onClick={onVolver}>
                    Volver
                </Button>
            </Pie>
        </>
    );
}
