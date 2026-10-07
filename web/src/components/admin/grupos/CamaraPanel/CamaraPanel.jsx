'use client';

import { useId } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import PanelLateral from '@/components/ui/PanelLateral';
import CamposCamara from '../CamaraForm/CamposCamara.jsx';
import { etiquetaPosicion } from '../CamaraForm/camaraForm.utils.js';
import { useCamaraForm } from '../CamaraForm/useCamaraForm.js';

// Alta de una cámara en un panel lateral (la tarjeta del aula se queda a la vista). Se monta solo mientras está abierto, así cada apertura
// empieza con el formulario limpio. Al guardar se cierra sin preguntar (lo guardado ya no es «cambio sin guardar»).
function ContenidoPanel({ idAula, posicion, onClose, onSaved }) {
    const formId = useId();
    const { f } = useCamaraForm({
        idAula,
        posicion,
        camara: undefined,
        onSaved: () => {
            onSaved?.();
            onClose();
        },
    });
    return (
        <PanelLateral
            open
            onClose={onClose}
            title={`Agregar cámara de ${posicion}`}
            description={`Cámara de la posición «${etiquetaPosicion(posicion)}» del aula. Podrás probar la conexión cuando esté guardada.`}
            dirty={f.sucio}
            onDiscard={() => f.reiniciar()}
            closeDisabled={f.enviando}
            footer={({ cerrar }) => (
                <FormActions flat dirty={f.cambios}>
                    <Button variant="secondary" onClick={cerrar} disabled={f.enviando}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={formId} loading={f.enviando}>
                        Agregar cámara
                    </Button>
                </FormActions>
            )}
        >
            <form id={formId} onSubmit={f.enviar} noValidate aria-label={`Nueva cámara de ${posicion}`} className="flex flex-col gap-4">
                <CamposCamara f={f} />
                {f.errorEnvio && (
                    <Alert tone="danger" compact title="No se pudo guardar la cámara">
                        {f.errorEnvio.message}
                    </Alert>
                )}
            </form>
        </PanelLateral>
    );
}

export default function CamaraPanel({ open, ...props }) {
    return open ? <ContenidoPanel {...props} /> : null;
}
