'use client';

import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import { useAvisarSucio } from '../compartido/useAvisarSucio.js';
import CamposCamara from './CamposCamara.jsx';
import { etiquetaEstatus, etiquetaPosicion } from './camaraForm.utils.js';
import { useCamaraForm } from './useCamaraForm.js';

const TONO_ESTATUS = { activa: 'success', mantenimiento: 'warning', inactiva: 'neutral' };

// Edición de una cámara que ya existe (frente o fondo) dentro de su tarjeta. El alta de una cámara nueva es un panel lateral (CamaraPanel).
// «Probar conexión» deja su resultado a la vista; y como la prueba usa la dirección GUARDADA, con cambios sin guardar se bloquea y lo dice.
export default function CamaraForm({ idAula, posicion, camara, onSaved, onSucioChange }) {
    const { f, probando, prueba, probar, puedeProbar, motivoProbar } = useCamaraForm({ idAula, posicion, camara, onSaved });
    useAvisarSucio(f.sucio, onSucioChange);

    return (
        <form onSubmit={f.enviar} noValidate className="flex flex-col gap-4" aria-label={`Cámara de ${posicion}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{etiquetaPosicion(posicion)}</h3>
                {camara && <Badge tone={TONO_ESTATUS[camara.estatus] ?? 'neutral'}>{etiquetaEstatus(camara.estatus)}</Badge>}
            </div>
            <CamposCamara f={f} conexion={{ prueba, probando, puedeProbar, motivo: motivoProbar, onProbar: probar }} />
            {f.errorEnvio && (
                <Alert tone="danger" compact title="No se pudo guardar la cámara">
                    {f.errorEnvio.message}
                </Alert>
            )}
            <FormActions sticky={false} dirty={f.cambios} className="sm:!flex-col sm:!items-stretch" motivoBloqueo={f.sucio ? undefined : 'Aún no hay cambios que guardar.'}>
                {f.sucio && (
                    <Button variant="secondary" onClick={() => f.reiniciar()} disabled={f.enviando}>
                        Descartar
                    </Button>
                )}
                <Button type="submit" loading={f.enviando} disabled={!f.sucio}>
                    Guardar cámara
                </Button>
            </FormActions>
        </form>
    );
}
