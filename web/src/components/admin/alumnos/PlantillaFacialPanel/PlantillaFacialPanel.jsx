'use client';

import { useEffect, useMemo, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CameraCapture from '@/components/ui/CameraCapture';
import DataState from '@/components/ui/DataState';
import FileInput from '@/components/ui/FileInput';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { solicitarUrlDocumento } from '@/lib/http/biometria.js';
import CalidadFotoResumen from '../CalidadFotoResumen';
import { esServicioNoDisponible, mensajeErrorPlantilla } from './plantillaFacial.utils.js';
import usePlantillaFacial from './usePlantillaFacial.js';

const MAX_FOTO_BYTES = 10 * 1024 * 1024;

// Vista previa con URL de objeto liberada al cambiar o desmontar.
function VistaPrevia({ blob }) {
    const url = useMemo(() => URL.createObjectURL(blob), [blob]);
    useEffect(() => () => URL.revokeObjectURL(url), [url]);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Vista previa de la foto capturada" className="max-h-64 rounded-2xl border border-border" />;
}

// Plantilla facial (RN-12/RN-13): solo con consentimiento vigente; la foto se verifica antes de registrarse.
export default function PlantillaFacialPanel({ idAlumno, version = 0, onCambio }) {
    const p = usePlantillaFacial({ idAlumno, version, onCambio });
    const { toast } = useToast();
    const [modo, setModo] = useState('camara');
    const [enlaceFoto, setEnlaceFoto] = useState(null);

    const cargando = p.consentimientos.loading || p.plantilla.loading;
    const error = p.consentimientos.error || p.plantilla.error;
    const datos = p.consentimientos.data && p.plantilla.data ? { c: p.consentimientos.data, p: p.plantilla.data } : null;
    const reintentar = () => {
        p.consentimientos.refetch();
        p.plantilla.refetch();
    };

    const verFoto = async () => {
        try {
            const r = await solicitarUrlDocumento({ tipo: 'plantilla', idRegistro: p.activa.id_plantilla });
            setEnlaceFoto(r.url);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo abrir la foto', message: err.message });
        }
    };

    const textoRegistrar = p.activa ? 'Reemplazar plantilla (la anterior se archivará)' : 'Registrar plantilla';
    const errorEnvio = p.envio.error;

    return (
        <Card title="Plantilla facial">
            <DataState loading={cargando} error={error} data={datos} onRetry={reintentar} isEmpty={() => false}>
                {() => (
                    <div className="flex flex-col gap-4">
                        <section aria-label="Plantilla actual" className="text-sm">
                            {p.activa ? (
                                <div className="flex flex-col gap-1">
                                    <p>Registrada: {p.activa.fecha_registro}</p>
                                    <p>Indexada: {p.activa.indexada ? 'sí' : 'no'}</p>
                                    <p>Versión del índice: {p.activa.version_indice ?? 'pendiente de indexar'}</p>
                                    {p.plantilla.data.archivadas?.total > 0 && (
                                        <p className="text-muted-foreground">{p.plantilla.data.archivadas.total} plantilla(s) archivada(s)</p>
                                    )}
                                    <div>
                                        <Button variant="secondary" size="sm" onClick={verFoto}>
                                            Ver foto
                                        </Button>
                                    </div>
                                    {enlaceFoto && (
                                        <a href={enlaceFoto} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                            Abrir foto (el enlace caduca en 5 minutos)
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Sin plantilla facial; el alumno pasa lista de forma manual.</p>
                            )}
                        </section>

                        {p.registro && (
                            <Alert tone={p.registro.indice === 'lista' ? 'success' : 'info'} title="Plantilla registrada">
                                {p.registro.indice === 'lista'
                                    ? `Índice listo${p.registro.version ? `, versión ${p.registro.version}` : ''}.`
                                    : p.registro.indice === 'tardando'
                                      ? 'El índice se actualiza en segundo plano y tarda más de lo esperado; vuelva a consultar más tarde.'
                                      : 'Indexando: el índice se actualiza en segundo plano.'}
                            </Alert>
                        )}

                        {!p.vigente ? (
                            <Alert tone="warning">Registre un consentimiento vigente para habilitar la captura.</Alert>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {!p.foto && (
                                    <>
                                        <div className="flex flex-wrap gap-2" role="group" aria-label="Origen de la foto">
                                            <Button variant={modo === 'camara' ? 'primary' : 'secondary'} size="sm" aria-pressed={modo === 'camara'} onClick={() => setModo('camara')}>
                                                Usar cámara
                                            </Button>
                                            <Button variant={modo === 'archivo' ? 'primary' : 'secondary'} size="sm" aria-pressed={modo === 'archivo'} onClick={() => setModo('archivo')}>
                                                Subir foto
                                            </Button>
                                        </div>
                                        {modo === 'camara' ? (
                                            <CameraCapture ovalGuide onCapture={(blob) => p.elegirFoto(blob)} />
                                        ) : (
                                            <FileInput accept="image/jpeg" maxBytes={MAX_FOTO_BYTES} label="Seleccionar foto (JPG)" value={null} onSelect={(f) => f && p.elegirFoto(f)} />
                                        )}
                                    </>
                                )}

                                {p.foto && (
                                    <div className="flex flex-col gap-3">
                                        <VistaPrevia blob={p.foto} />
                                        {p.verificacion.cargando && (
                                            <p className="flex items-center gap-2 text-sm" aria-live="polite">
                                                <Spinner size="sm" label="Verificando calidad" /> Verificando calidad…
                                            </p>
                                        )}
                                        {p.verificacion.error && (
                                            <Alert tone="danger" title="No se pudo verificar la foto">
                                                {mensajeErrorPlantilla(p.verificacion.error)}
                                                <div className="mt-2">
                                                    <Button variant="secondary" size="sm" onClick={p.reintentarVerificacion}>
                                                        Reintentar verificación
                                                    </Button>
                                                </div>
                                            </Alert>
                                        )}
                                        <CalidadFotoResumen resultado={p.verificacion.resultado} />
                                        {errorEnvio && (
                                            <Alert tone="danger" title="No se pudo registrar la plantilla">
                                                {mensajeErrorPlantilla(errorEnvio)}
                                                {esServicioNoDisponible(errorEnvio) && (
                                                    <div className="mt-2">
                                                        <Button variant="secondary" size="sm" onClick={p.registrar}>
                                                            Reintentar
                                                        </Button>
                                                    </div>
                                                )}
                                            </Alert>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="secondary" onClick={() => p.elegirFoto(null)} disabled={p.envio.cargando}>
                                                Repetir captura
                                            </Button>
                                            <Button onClick={p.registrar} disabled={!p.puedeRegistrar} loading={p.envio.cargando}>
                                                {textoRegistrar}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </DataState>
        </Card>
    );
}
