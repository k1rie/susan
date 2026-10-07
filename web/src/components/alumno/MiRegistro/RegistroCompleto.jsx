import { CircleCheck, Clock } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { fechaLarga, registrosRestantes } from './miRegistro.utils.js';

// Paso 3: el registro está completo. Si la plantilla aún no entra al índice se dice (en minutos queda activa) y se puede actualizar.
export default function RegistroCompleto({ registro, onRehacer, onActualizar }) {
    const plantilla = registro.plantilla;
    const restantes = registrosRestantes(registro);
    return (
        <Card title="Tu rostro está registrado">
            <div className="flex flex-col gap-4">
                {plantilla.indexada ? (
                    <Alert tone="success" title="Todo listo">
                        Tu docente podrá pasar lista con la cámara del aula y te reconocerá desde la siguiente clase.
                    </Alert>
                ) : (
                    <Alert tone="info" title="Se está procesando">
                        Tu plantilla ya quedó guardada y en unos minutos estará activa. Puedes cerrar esta pantalla.
                    </Alert>
                )}
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-xs text-muted-foreground">Registrado</dt>
                        <dd className="font-medium">{fechaLarga(plantilla.fecha_registro) || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Tomas</dt>
                        <dd className="font-medium">{plantilla.n_fotos}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Estado</dt>
                        <dd className="flex items-center gap-1.5 font-medium">
                            {plantilla.indexada ? (
                                <CircleCheck aria-hidden="true" className="size-4 text-presente" strokeWidth={1.75} />
                            ) : (
                                <Clock aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />
                            )}
                            {plantilla.indexada ? 'Activo' : 'Procesando'}
                        </dd>
                    </div>
                </dl>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {!plantilla.indexada && (
                        <Button variant="ghost" onClick={onActualizar}>
                            Actualizar estado
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onRehacer} disabled={restantes === 0}>
                        Volver a registrar mi rostro
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Al volver a registrarlo, la plantilla anterior se archiva. Hoy te {restantes === 1 ? 'queda' : 'quedan'} {restantes}{' '}
                    de {registro.limite_registros_24h} {restantes === 1 ? 'registro' : 'registros'}.
                </p>
            </div>
        </Card>
    );
}
