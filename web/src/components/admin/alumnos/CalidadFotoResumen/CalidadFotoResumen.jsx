import Badge from '@/components/ui/Badge';
import { textoMotivo } from '../PlantillaFacialPanel/plantillaFacial.utils.js';

function Renglon({ etiqueta, valor, ok }) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1 last:border-b-0">
            <span>
                {etiqueta}: <span className="text-muted">{valor}</span>
            </span>
            <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Correcto' : 'Revisar'}</Badge>
        </li>
    );
}

// Resultado de POST /api/plantilla/verificar. Texto y color en cada renglón.
export default function CalidadFotoResumen({ resultado }) {
    if (!resultado) return null;
    const c = resultado.calidad ?? {};
    const motivo = resultado.motivo_rechazo;
    const num = (n, d = 0) => (typeof n === 'number' ? n.toFixed(d) : '-');
    return (
        <div className="flex flex-col gap-2 text-sm">
            <ul aria-label="Calidad de la foto">
                <Renglon etiqueta="Rostros detectados" valor={resultado.rostros ?? 0} ok={resultado.un_solo_rostro === true} />
                <Renglon etiqueta="Brillo" valor={num(c.brillo)} ok={motivo !== 'POCA_LUZ' && motivo !== 'EXCESO_LUZ'} />
                <Renglon etiqueta="Nitidez" valor={num(c.nitidez)} ok={motivo !== 'BORROSA'} />
                <Renglon etiqueta="Tamaño del rostro" valor={`${num(c.tamano_rostro ?? c.tamano_rostro_px)} px`} ok={motivo !== 'ROSTRO_PEQUENO'} />
                <Renglon etiqueta="De frente" valor={c.frontal ? 'sí' : 'no'} ok={c.frontal === true} />
            </ul>
            {motivo && (
                <p role="alert" className="font-medium text-danger">
                    Foto rechazada: {textoMotivo(motivo)}
                </p>
            )}
        </div>
    );
}
