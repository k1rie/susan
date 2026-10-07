'use client';

import { useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import Detalles from '@/components/ui/Detalles';
import { useToast } from '@/components/ui/Toast';
import { solicitarUrlDocumento } from '@/lib/http/biometria.js';
import CalidadFotoResumen from '../CalidadFotoResumen';
import CapturaGuiadaPlantilla from '../CapturaGuiadaPlantilla';
import { numerarTomas } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import SubidaFotosPlantilla from '../SubidaFotosPlantilla';
import { esServicioNoDisponible, mensajeErrorPlantilla, resultadoDeToma, textoContador, textoFotos } from './plantillaFacial.utils.js';
import usePlantillaFacial from './usePlantillaFacial.js';

const dec = (n) => (typeof n === 'number' ? n.toFixed(2) : '-');

// Plantilla facial (RN-12/RN-13): solo con consentimiento vigente. Se arma con 3 a 8 tomas del mismo alumno
// (5 guiadas por defecto) cuyos vectores el servicio promedia en uno solo; cada toma se verifica antes de registrar.
export default function PlantillaFacialPanel({ idAlumno, version = 0, onCambio }) {
    const p = usePlantillaFacial({ idAlumno, version, onCambio });
    const { toast } = useToast();
    const [enlaceFoto, setEnlaceFoto] = useState(null);
    const [enlacesPorFoto, setEnlacesPorFoto] = useState({});
    const botonRef = useRef(null);
    const [pedirFoco, setPedirFoco] = useState(0);

    // Tras repetir o quitar el botón de la toma desaparece: el foco pasa al botón de captura. Se hace en un
    // efecto porque ese botón puede estar deshabilitado hasta que se pinte el estado nuevo.
    useEffect(() => {
        if (pedirFoco > 0) botonRef.current?.focus();
    }, [pedirFoco]);

    const cargando = p.consentimientos.loading || p.plantilla.loading;
    const error = p.consentimientos.error || p.plantilla.error;
    const datos = p.consentimientos.data && p.plantilla.data ? { c: p.consentimientos.data, p: p.plantilla.data } : null;
    const reintentar = () => {
        p.consentimientos.refetch();
        p.plantilla.refetch();
    };

    // La URL firmada dura <= 300 s y cada consulta queda en bitácora (RF-19): se pide solo al pulsar.
    const abrir = async (solicitud, guardar) => {
        try {
            const r = await solicitarUrlDocumento(solicitud);
            guardar(r.url);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo abrir la foto', message: err.message });
        }
    };
    // `?.` no es decorativo: el React Compiler calcula las dependencias del cierre al renderizar y, sin plantilla
    // activa (alumno recién dado de alta), `p.activa.id_plantilla` reventaba el panel entero.
    const verFoto = () => abrir({ tipo: 'plantilla', idRegistro: p.activa?.id_plantilla }, setEnlaceFoto);
    const verFotoN = (f) => abrir({ tipo: 'plantilla_foto', idRegistro: f.id_foto }, (url) => setEnlacesPorFoto((m) => ({ ...m, [f.id_foto]: url })));

    const enviando = p.envio.cargando;
    const total = p.tomas.length;
    const marcadas = p.tomas.filter((t) => t.estado !== 'aceptada' && t.estado !== 'verificando').length;
    const resultado = p.verificacion.resultado;
    const numeros = numerarTomas(p.tomas, p.modo);
    const detallesCalidad = p.ordenadas.filter((t) => t.estado !== 'verificando');
    const nFotosActiva = p.activa?.n_fotos ?? 1;
    // Las fotos de registro se borran al indexarse (extensión 18). Sin la clave (servidor anterior) se asume que existen.
    const fotoDisponible = p.activa?.foto_disponible !== false;
    const hayFotosSueltas = (p.activa?.fotos ?? []).some((f) => f.disponible !== false);
    // Los textos de botón deben caber en ~286 px (360 px de pantalla): ui/Button no parte líneas (whitespace-nowrap).
    // Lo que no cabe va en una nota de texto plano justo debajo, nunca en la etiqueta.
    const textoRegistrar = p.activa ? 'Reemplazar plantilla' : `Registrar plantilla con ${textoFotos(total)}`;

    const alQuitar = (id) => {
        p.quitarToma(id);
        setPedirFoco((n) => n + 1);
    };
    const alRepetir = (id) => {
        p.repetirToma(id);
        setPedirFoco((n) => n + 1);
    };

    return (
        <Card title="Plantilla facial">
            <DataState loading={cargando} error={error} data={datos} onRetry={reintentar} isEmpty={() => false}>
                {() => (
                    <div className="flex flex-col gap-4">
                        <section aria-label="Plantilla actual" className="text-sm">
                            {p.activa ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-col gap-1">
                                        <p>Registrada: {p.activa.fecha_registro}</p>
                                        <p>Indexada: {p.activa.indexada ? 'sí' : 'no'}</p>
                                        <p>Versión del índice: {p.activa.version_indice ?? 'pendiente de indexar'}</p>
                                        <p>Fotos: {nFotosActiva}</p>
                                        {p.plantilla.data.archivadas?.total > 0 && (
                                            <p className="text-muted-foreground">{p.plantilla.data.archivadas.total} plantilla(s) archivada(s)</p>
                                        )}
                                    </div>
                                    {p.activa.coseno_medio != null ? (
                                        <Detalles titulo="Consistencia entre fotos">
                                            <p>
                                                Al registrar, cada foto se parecía en promedio {dec(p.activa.coseno_medio)} a las demás (mínimo {dec(p.activa.coseno_min)}).
                                                Dato informativo medido por el servicio de reconocimiento.
                                            </p>
                                        </Detalles>
                                    ) : (
                                        nFotosActiva === 1 && (
                                            <p className="text-muted-foreground">Plantilla de una sola foto: se recomienda registrar de 3 a 5 tomas.</p>
                                        )
                                    )}
                                    {fotoDisponible ? (
                                        <div>
                                            <Button variant="secondary" size="sm" onClick={verFoto}>
                                                Ver foto
                                            </Button>
                                        </div>
                                    ) : (
                                        !hayFotosSueltas && (
                                            <p className="text-muted-foreground">
                                                Las fotos no se conservan: solo se guarda el vector del rostro en el índice.
                                            </p>
                                        )
                                    )}
                                    {enlaceFoto && fotoDisponible && (
                                        <a href={enlaceFoto} target="_blank" rel="noopener noreferrer" className="text-link underline">
                                            Abrir foto (el enlace caduca en 5 minutos)
                                        </a>
                                    )}
                                    {nFotosActiva > 1 && hayFotosSueltas && (
                                        <Detalles titulo={`Ver las ${nFotosActiva} fotos`}>
                                            <ul className="flex flex-col gap-2">
                                                {p.activa.fotos.filter((f) => f.disponible !== false).map((f) => (
                                                    <li key={f.id_foto} className="flex flex-col items-start gap-1">
                                                        <Button variant="secondary" size="sm" onClick={() => verFotoN(f)}>
                                                            Abrir foto {f.orden}
                                                        </Button>
                                                        {enlacesPorFoto[f.id_foto] && (
                                                            <a href={enlacesPorFoto[f.id_foto]} target="_blank" rel="noopener noreferrer" className="text-link underline">
                                                                Abrir foto {f.orden} (el enlace caduca en 5 minutos)
                                                            </a>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </Detalles>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Sin plantilla facial; el alumno pasa lista de forma manual.</p>
                            )}
                        </section>

                        {p.registro && <ResultadoRegistro registro={p.registro} />}

                        {!p.vigente ? (
                            <Alert tone="warning">Registre un consentimiento vigente para habilitar la captura.</Alert>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <Detalles titulo="¿Por qué varias fotos?">
                                    <p className="text-sm">SUSAN promedia las fotos para reconocer mejor con distintos ángulos y luz.</p>
                                </Detalles>

                                <div className="flex flex-wrap gap-2" role="group" aria-label="Origen de las fotos">
                                    <Button variant={p.modo === 'camara' ? 'primary' : 'secondary'} size="sm" aria-pressed={p.modo === 'camara'} onClick={() => p.setModo('camara')} disabled={enviando}>
                                        Usar cámara
                                    </Button>
                                    <Button variant={p.modo === 'archivo' ? 'primary' : 'secondary'} size="sm" aria-pressed={p.modo === 'archivo'} onClick={() => p.setModo('archivo')} disabled={enviando}>
                                        Subir fotos
                                    </Button>
                                </div>

                                {p.modo === 'camara' ? (
                                    <CapturaGuiadaPlantilla
                                        tomas={p.tomas}
                                        minimo={p.minimo}
                                        maximo={p.maximo}
                                        deshabilitado={enviando}
                                        onCapturar={(blob, paso) => p.agregarToma(blob, 'camara', { paso })}
                                        onRepetir={alRepetir}
                                        onQuitar={alQuitar}
                                        botonRef={botonRef}
                                    />
                                ) : (
                                    <SubidaFotosPlantilla
                                        tomas={p.tomas}
                                        minimo={p.minimo}
                                        maximo={p.maximo}
                                        deshabilitado={enviando}
                                        onAgregar={(blob, { nombre }) => p.agregarToma(blob, 'archivo', { nombre })}
                                        onQuitar={alQuitar}
                                        botonRef={botonRef}
                                    />
                                )}

                                <p className="text-sm">{textoContador({ total, aceptadas: p.aceptadas, marcadas, minimo: p.minimo })}</p>
                                <div role="status" aria-live="polite" className="sr-only">
                                    {p.anuncio} {textoContador({ total, aceptadas: p.aceptadas, marcadas, minimo: p.minimo })}
                                </div>

                                {p.verificacion.error && (
                                    <Alert tone="danger" title="No se pudieron verificar las fotos">
                                        {mensajeErrorPlantilla(p.verificacion.error)}
                                        <div className="mt-2">
                                            <Button variant="secondary" size="sm" onClick={p.verificacion.reintentar}>
                                                Reintentar verificación
                                            </Button>
                                        </div>
                                    </Alert>
                                )}
                                {resultado?.ambiguo && (
                                    <Alert tone="warning">Las tomas no coinciden entre sí. Revisa que todas sean del mismo alumno.</Alert>
                                )}
                                {resultado?.advertencias?.includes('DIVERSIDAD_BAJA') && (
                                    <Alert tone="info">Las tomas son casi idénticas; varía el ángulo, la expresión o la luz.</Alert>
                                )}

                                {detallesCalidad.length > 0 && (
                                    <Detalles titulo="Ver detalles de calidad">
                                        <div className="flex flex-col gap-4">
                                            {detallesCalidad.map((t) => (
                                                <CalidadFotoResumen
                                                    key={t.id}
                                                    resultado={resultadoDeToma(t)}
                                                    titulo={`Toma ${numeros.get(t.id)}`}
                                                    guiada={t.origen === 'camara'}
                                                />
                                            ))}
                                        </div>
                                    </Detalles>
                                )}

                                {p.envio.error && (
                                    <Alert tone="danger" title="No se pudo registrar la plantilla">
                                        {mensajeErrorPlantilla(p.envio.error)}
                                        {esServicioNoDisponible(p.envio.error) && (
                                            <div className="mt-2">
                                                <Button variant="secondary" size="sm" onClick={p.reintentarEnvio}>
                                                    Reintentar
                                                </Button>
                                            </div>
                                        )}
                                    </Alert>
                                )}

                                {enviando && (
                                    <p role="status" className="text-sm text-muted-foreground">
                                        Subiendo {textoFotos(total)} y actualizando el índice. Puede tardar un minuto; no cierres esta ventana.
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={p.registrar} disabled={!p.puedeRegistrar} loading={enviando}>
                                        {textoRegistrar}
                                    </Button>
                                    {p.puedeRegistrarUna && (
                                        <Button variant="ghost" onClick={p.registrarUna} disabled={enviando}>
                                            Registrar con una sola foto
                                        </Button>
                                    )}
                                    {total > 0 && (
                                        <Button variant="ghost" onClick={p.limpiar} disabled={enviando}>
                                            Quitar todas las tomas
                                        </Button>
                                    )}
                                </div>
                                {(p.activa || p.puedeRegistrarUna) && (
                                    <p className="text-xs text-muted-foreground break-words">
                                        {p.activa && 'La plantilla anterior se archivará al reemplazarla. '}
                                        {p.puedeRegistrarUna && 'Registrar con una sola foto es menos preciso que usar de 3 a 8 tomas.'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </DataState>
        </Card>
    );
}

// Resultado del último registro: éxito, índice pendiente (la plantilla quedó guardada) y fotos que el índice descartó.
function ResultadoRegistro({ registro }) {
    const base = `Plantilla registrada con ${textoFotos(registro.nFotos ?? 1)}.`;
    return (
        <div className="flex flex-col gap-2">
            {registro.indice === 'pendiente' ? (
                <Alert tone="warning" title="Plantilla guardada, índice pendiente">
                    La plantilla quedó guardada pero el índice no se pudo actualizar; pide a un técnico que lo reconstruya.
                </Alert>
            ) : (
                <Alert tone={registro.indice === 'lista' ? 'success' : 'info'}>
                    {registro.indice === 'lista'
                        ? `${base} Índice listo${registro.version ? `, versión ${registro.version}` : ''}.`
                        : registro.indice === 'tardando'
                          ? `${base} El índice se actualiza en segundo plano y tarda más de lo esperado; vuelva a consultar más tarde.`
                          : `${base} Indexando: el índice se actualiza en segundo plano.`}
                </Alert>
            )}
            {registro.descartadas > 0 && (
                <Alert tone="warning">
                    El índice descartó {registro.descartadas} {registro.descartadas === 1 ? 'foto' : 'fotos'} al promediar; revisa la consistencia.
                </Alert>
            )}
        </div>
    );
}
