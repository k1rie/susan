'use client';

import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import RecorteFirmado from '../RecorteFirmado';
import { formatearHora } from '../PlazoRestante/plazoRestante.utils.js';
import { recortePurgado, resumenValidas, textoCamara, textoScore } from './lecturasCaso.utils.js';
import { useLecturasCaso } from './useLecturasCaso.js';

// Evidencia del caso: foto de registro y una fila por lectura (hora, cámara, score, validez, recorte).
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
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{resumenValidas(lecturas, minimoValidas)}</p>
                <Button size="sm" variant="ghost" onClick={recargar}>
                    Renovar recortes
                </Button>
            </div>
            <div className="flex items-center gap-3 text-sm">
                <RecorteFirmado
                    url={data?.foto_registro?.url ?? null}
                    alt="Foto de registro del alumno"
                    onExpirada={recargar}
                />
                <span className="text-muted-foreground">
                    {data?.foto_registro ? 'Foto de registro' : 'El alumno no tiene foto de registro activa'}
                </span>
            </div>
            {lecturas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin lecturas del reconocimiento facial en esta sesión</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {lecturas.map((l) => (
                        <li key={l.id_deteccion} className="flex items-center gap-3 rounded-md border border-border p-2 text-sm">
                            <RecorteFirmado
                                url={l.recorte?.url ?? null}
                                purgado={recortePurgado(l)}
                                alt={`Recorte de la lectura de las ${formatearHora(l.marca_tiempo)}`}
                                onExpirada={recargar}
                            />
                            <div className="min-w-0">
                                <p className="font-medium">
                                    {formatearHora(l.marca_tiempo)} · {textoCamara(l.camara_posicion)}
                                </p>
                                <p className="text-muted-foreground">
                                    Minuto {Number(l.minuto_sesion).toFixed(1)} · Score {textoScore(l.score_similitud)}
                                </p>
                                <p className={l.es_valida ? 'text-presente' : 'text-ausente'}>
                                    {l.es_valida ? 'Válida' : 'No válida'}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
