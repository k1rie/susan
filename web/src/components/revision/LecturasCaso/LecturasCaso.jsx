'use client';

import clsx from 'clsx';
import Alert from '@/components/ui/Alert';
import BarrasPildora from '@/components/ui/BarrasPildora';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import RecorteFirmado from '../RecorteFirmado';
import { formatearHora } from '../PlazoRestante/plazoRestante.utils.js';
import { CONFIG_SCORES, contarConScore, datosScores, lecturasNumeradas, progresoValidas, recortePurgado, resumenScores, resumenValidas, textoCamara, textoScore } from './lecturasCaso.utils.js';
import { useLecturasCaso } from './useLecturasCaso.js';

// Evidencia del caso: avance de lecturas válidas, gráfica de scores, foto de registro y una tarjeta compacta por lectura.
// `minimoValidas` viene de la cola (parámetro del servidor). Si falla la carga, resolver sigue disponible.
export default function LecturasCaso({ idAsistencia, minimoValidas }) {
    const { estado, data, error, recargar } = useLecturasCaso(idAsistencia);

    if (estado === 'cargando') {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size="sm" label="Cargando lecturas" /> Cargando lecturas…
            </div>
        );
    }
    if (estado === 'error') {
        return (
            <Alert tone="danger" title="No se pudieron cargar las lecturas">
                <p>{error?.message}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={recargar}>
                    Reintentar
                </Button>
            </Alert>
        );
    }

    const lecturas = data?.lecturas ?? [];
    // Mismo orden y mismo número en la gráfica y en la lista: «lectura 3» es la misma en ambas.
    const ordenadas = lecturasNumeradas(lecturas);
    const avance = progresoValidas(lecturas, minimoValidas);
    const scores = datosScores(lecturas);
    const conScore = contarConScore(lecturas);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{resumenValidas(lecturas, minimoValidas)}</p>
                    {avance.minimo && (
                        <span
                            role="progressbar"
                            aria-label="Lecturas válidas frente al mínimo"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(avance.ancho)}
                            aria-valuetext={`${avance.validas} de ${avance.minimo}`}
                            className="mt-1.5 block h-1.5 max-w-60 overflow-hidden rounded-full bg-muted"
                        >
                            <span className={clsx('block h-full rounded-full', avance.cumple ? 'bg-presente' : 'bg-retardo')} style={{ width: `${avance.ancho}%` }} />
                        </span>
                    )}
                </div>
                <Button size="sm" variant="ghost" onClick={recargar}>
                    Renovar recortes
                </Button>
            </div>

            {scores.length >= 2 && (
                <TarjetaGrafica
                    titulo="Score por lectura"
                    descripcion="Similitud con la foto de registro (%), por número de lectura"
                    resumen={resumenScores(scores)}
                    pie={conScore > scores.length ? `Se muestran las ${scores.length} más recientes de ${conScore}.` : undefined}
                >
                    <BarrasPildora datos={scores} ejeX="lectura" series={[{ clave: 'valida' }, { clave: 'no_valida' }]} config={CONFIG_SCORES} apilado unidad=" %" dominio={[0, 100]} alto={170} leyenda />
                </TarjetaGrafica>
            )}

            <div className="flex items-center gap-3 text-sm">
                <RecorteFirmado url={data?.foto_registro?.url ?? null} alt="Foto de registro del alumno" onExpirada={recargar} />
                <span className="text-muted-foreground">{data?.foto_registro ? 'Foto de registro' : 'Sin foto de registro activa'}</span>
            </div>
            {lecturas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin lecturas del reconocimiento facial en esta sesión.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ordenadas.map((l) => (
                        <li key={l.id_deteccion} className="flex items-center gap-3 rounded-xl border border-border p-2 text-sm">
                            <RecorteFirmado
                                url={l.recorte?.url ?? null}
                                purgado={recortePurgado(l)}
                                alt={`Recorte de la lectura ${l.numero}, de las ${formatearHora(l.marca_tiempo)}`}
                                onExpirada={recargar}
                            />
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    Lectura {l.numero} · {formatearHora(l.marca_tiempo)}
                                </p>
                                {/* Sin truncate: a 360 px el score es el dato que importa y se cortaba («Score 0.4…»); si no cabe, baja de línea
                                    y «Score 0.420» viaja junto. */}
                                <p className="text-muted-foreground">
                                    {textoCamara(l.camara_posicion)} · <span className="whitespace-nowrap">Score {textoScore(l.score_similitud)}</span>
                                </p>
                                <p className="truncate">
                                    <span className={l.es_valida ? 'text-presente' : 'text-ausente'}>{l.es_valida ? 'Válida' : 'No válida'}</span>
                                    <span className="text-muted-foreground"> · min {Number(l.minuto_sesion).toFixed(1)}</span>
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
