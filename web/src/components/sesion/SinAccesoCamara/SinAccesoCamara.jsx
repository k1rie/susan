import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';

// Aviso cuando la cámara de este dispositivo no se puede usar (permiso negado, sin cámara, página no segura…). No deja al docente en un
// callejón: ofrece cada salida que existe. En teléfono los botones se apilan a todo el ancho.
//   mensaje       = lo que dijo la cámara (ya traducido: cameraCapture.utils)
//   onReintentar  = vuelve a pedir la cámara (tras dar el permiso en el navegador)
//   camarasIp     = cuántas cámaras IP activas hay en el aula; con alguna se ofrece seguir solo con ellas (onSoloIp)
//   onManual      = abre el registro manual de un alumno
//   onSimulada    = solo con el reloj de demostración (desarrollo local): usar la cámara simulada. Sin función, no se ofrece.
export default function SinAccesoCamara({ mensaje, onReintentar, camarasIp = 0, onSoloIp, onManual, onSimulada }) {
    return (
        <Alert tone="warning" title="No se pudo usar la cámara de este dispositivo">
            <p>{mensaje || 'La cámara no está disponible.'}</p>
            <p className="mt-1">Puedes seguir de otra forma:</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {onReintentar && (
                    <Button variant="secondary" onClick={onReintentar} className="w-full sm:w-auto">
                        Reintentar con la cámara
                    </Button>
                )}
                {camarasIp > 0 && onSoloIp && (
                    <Button variant="secondary" onClick={onSoloIp} className="w-full sm:w-auto">
                        {camarasIp === 1 ? 'Seguir con la cámara IP del aula' : `Seguir con las ${camarasIp} cámaras IP del aula`}
                    </Button>
                )}
                {onManual && (
                    <Button variant="secondary" onClick={onManual} className="w-full sm:w-auto">
                        Registrar manualmente
                    </Button>
                )}
                {onSimulada && (
                    <Button variant="secondary" onClick={onSimulada} className="w-full sm:w-auto">
                        Usar la cámara simulada
                    </Button>
                )}
            </div>
        </Alert>
    );
}
