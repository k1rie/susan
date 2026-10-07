'use client';

import { CircleCheck, Info, OctagonAlert, Wifi } from 'lucide-react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { EJEMPLO_IP, ESTATUS_CAMARA, TIPOS } from './camaraForm.utils.js';

// Bloque «Conexión»: botón de prueba y el RESULTADO que se queda a la vista con su hora (éxito, fallo o sin probar), más el motivo
// por el que la prueba no está disponible. Estado siempre con icono y texto, nunca solo color.
export function EstadoConexion({ prueba, probando, puedeProbar, motivo, onProbar }) {
    return (
        <section aria-label="Prueba de conexión" className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Conexión</h4>
                <Button variant="secondary" size="sm" loading={probando} disabled={!puedeProbar} icon={<Wifi aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={onProbar}>
                    Probar conexión
                </Button>
            </div>
            <div aria-live="polite" className="text-sm">
                {probando ? (
                    <p className="text-muted-foreground">Probando…</p>
                ) : prueba ? (
                    <div className="flex items-start gap-2">
                        {prueba.ok ? (
                            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-presente" strokeWidth={1.75} />
                        ) : (
                            <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ausente" strokeWidth={1.75} />
                        )}
                        <p>
                            <span className={prueba.ok ? 'font-medium text-presente' : 'font-medium text-ausente'}>{prueba.titulo}</span>
                            <span className="text-muted-foreground"> · a las {prueba.hora}</span>
                            {prueba.detalle && <span className="block text-[13px] text-muted-foreground">{prueba.detalle}</span>}
                            {!prueba.ok && <span className="block text-[13px] text-muted-foreground">Revisa que la cámara esté encendida, en la misma red y con esa dirección IP.</span>}
                        </p>
                    </div>
                ) : (
                    <p className="flex items-center gap-2 text-muted-foreground">
                        <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                        Sin probar con la dirección actual.
                    </p>
                )}
            </div>
            {motivo && <p className="text-xs text-muted-foreground">{motivo}</p>}
        </section>
    );
}

// Campos de la cámara (tipo, dirección y estatus): tipo y estatus son segmentados (2 y 3 opciones visibles), la IP lleva su ejemplo.
export default function CamposCamara({ f, conexion }) {
    const tipo = f.campo('tipo');
    const ip = f.campo('direccion_ip');
    const estatus = f.campo('estatus');
    return (
        <div className="flex flex-col gap-4">
            <Field as="fieldset" label="Tipo de cámara">
                <SegmentedControl label="Tipo de cámara" items={TIPOS} value={tipo.value} onChange={tipo.onChange} fullWidth />
            </Field>
            {tipo.value === 'ip' && (
                <Field label="Dirección IP" required error={ip.error} hint="La dirección de la cámara en la red del plantel." example={EJEMPLO_IP}>
                    <Input {...ip.props} transform="trim" inputMode="decimal" autoComplete="off" placeholder={EJEMPLO_IP} />
                </Field>
            )}
            <Field as="fieldset" label="Estatus" hint="Solo las cámaras activas se usan en el pase de lista automático.">
                <SegmentedControl label="Estatus de la cámara" items={ESTATUS_CAMARA} value={estatus.value} onChange={estatus.onChange} fullWidth />
            </Field>
            {conexion && <EstadoConexion {...conexion} />}
        </div>
    );
}
