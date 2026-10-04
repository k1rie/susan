import Badge from '@/components/ui/Badge';
import { codigoDeMotivo, textoMotivo } from '../PlantillaFacialPanel/plantillaFacial.utils.js';

function Renglon({ etiqueta, valor, ok }) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1 last:border-b-0">
            <span className="min-w-0 break-words">
                {etiqueta}: <span className="text-muted-foreground">{valor}</span>
            </span>
            <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Correcto' : 'Revisar'}</Badge>
        </li>
    );
}

const num = (n, d = 0) => (typeof n === 'number' ? n.toFixed(d) : '-');

// Cada renglón se decide por el código estable (motivo_codigo), no por la frase del servicio: antes se
// comparaba contra códigos que el servicio ya no devolvía y todo salía «Correcto».
const FALLAS_DE_ROSTROS = ['SIN_ROSTRO', 'MULTIPLES_ROSTROS'];
const FALLAS_DE_PARECIDO = ['NO_COINCIDE', 'CONJUNTO_AMBIGUO'];

/**
 * Calidad de UNA foto: una toma del conjunto (POST /api/plantilla/verificar con `fotos`) o el resultado heredado
 * de una sola foto. Texto y color en cada renglón. `titulo` rotula el bloque cuando se apilan varias tomas.
 */
export default function CalidadFotoResumen({ resultado, titulo, guiada = false }) {
    if (!resultado) return null;
    const c = resultado.calidad ?? {};
    const codigo = codigoDeMotivo(resultado);
    const motivo = codigo ?? resultado.motivo_rechazo ?? null;
    const ilegible = resultado.estado === 'ilegible';
    const coseno = resultado.coseno_resto;
    return (
        <div className="flex flex-col gap-1 text-sm">
            {titulo && <p className="font-medium">{titulo}</p>}
            {!ilegible && (
                <ul aria-label={titulo ? `Calidad de ${titulo}` : 'Calidad de la foto'}>
                    <Renglon etiqueta="Rostros detectados" valor={resultado.rostros ?? 0} ok={resultado.un_solo_rostro === true && !FALLAS_DE_ROSTROS.includes(codigo)} />
                    <Renglon etiqueta="Brillo" valor={num(c.brillo)} ok={codigo !== 'POCA_LUZ' && codigo !== 'EXCESO_LUZ'} />
                    <Renglon etiqueta="Nitidez" valor={num(c.nitidez)} ok={codigo !== 'BORROSA'} />
                    <Renglon etiqueta="Tamaño del rostro" valor={`${num(c.tamano_rostro ?? c.tamano_rostro_px)} px`} ok={codigo !== 'ROSTRO_PEQUENO'} />
                    <Renglon etiqueta="De frente" valor={c.frontal ? 'sí' : 'no'} ok={c.frontal === true} />
                    {typeof coseno === 'number' && (
                        <Renglon etiqueta="Parecido con las demás fotos" valor={coseno.toFixed(2)} ok={!FALLAS_DE_PARECIDO.includes(codigo)} />
                    )}
                </ul>
            )}
            {motivo && (
                <p className="font-medium text-destructive">
                    {ilegible ? 'Foto ilegible' : 'Foto rechazada'}: {textoMotivo(motivo, { guiada, frase: resultado.motivo_rechazo })}
                </p>
            )}
        </div>
    );
}
