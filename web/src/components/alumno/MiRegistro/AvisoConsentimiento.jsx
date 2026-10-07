'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import { DECLARACION, TITULO_AVISO, VERSION_AVISO, seccionesAviso } from '@/lib/avisoBiometrico.js';

// Paso 1: el alumno lee el aviso y lo acepta con su sesión. La constancia PDF la genera el servidor con este mismo texto (y su huella).
// La casilla es la manifestación de voluntad: sin marcarla se explica qué falta en lugar de dejar el botón apagado y mudo.
export default function AvisoConsentimiento({ meses = 12, aceptando = false, error = null, onAceptar }) {
    const [acepto, setAcepto] = useState(false);
    const [faltaCasilla, setFaltaCasilla] = useState(false);

    const alAceptar = () => {
        if (!acepto) {
            setFaltaCasilla(true);
            return;
        }
        onAceptar();
    };

    return (
        <Card title={TITULO_AVISO}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                    {seccionesAviso(meses).map((s) => (
                        <section key={s.titulo} className="flex flex-col gap-1">
                            <h3 className="text-sm font-semibold">{s.titulo}</h3>
                            {s.parrafos.map((p) => (
                                <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                                    {p}
                                </p>
                            ))}
                        </section>
                    ))}
                    <p className="text-xs text-muted-foreground">Versión del aviso: {VERSION_AVISO}</p>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <Checkbox
                        checked={acepto}
                        onChange={(e) => {
                            setAcepto(e.target.checked);
                            if (e.target.checked) setFaltaCasilla(false);
                        }}
                        label={DECLARACION}
                        error={faltaCasilla && !acepto ? 'Marca la declaración para continuar.' : undefined}
                    />
                    {error && (
                        <Alert tone="danger" title="No se pudo registrar tu aceptación">
                            {error.message}
                        </Alert>
                    )}
                    <div className="flex justify-end">
                        <Button
                            onClick={alAceptar}
                            loading={aceptando}
                            icon={<ShieldCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                        >
                            Aceptar y continuar
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
