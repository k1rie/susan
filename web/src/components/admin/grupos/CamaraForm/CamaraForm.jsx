'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { camaraGuardar } from '@/lib/api/admin.js';
import { probarCamara } from '@/lib/http/admin.js';
import { datosCamara, ESTATUS_CAMARA, etiquetaPosicion, TIPOS, validarCamara } from './camaraForm.utils.js';

// Una cámara (frente o fondo) de un aula: alta o edición y prueba de conexión.
export default function CamaraForm({ idAula, posicion, camara, onSaved }) {
    const { toast } = useToast();
    const guardar = useApiMutation(camaraGuardar);
    const [valores, setValores] = useState({
        tipo: camara?.tipo ?? 'ip',
        direccion_ip: camara?.direccion_ip ?? '',
        estatus: camara?.estatus ?? 'activa',
    });
    const [errores, setErrores] = useState({});
    const [probando, setProbando] = useState(false);
    const [prueba, setPrueba] = useState(null);

    const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

    const enviar = async (e) => {
        e.preventDefault();
        const err = validarCamara(valores);
        setErrores(err);
        if (Object.keys(err).length) return;
        try {
            await guardar.run({ datos: datosCamara(valores, { idAula, posicion, idCamara: camara?.id_camara }) });
            toast({ tone: 'success', message: `Cámara de ${posicion} guardada.` });
            setPrueba(null);
            onSaved?.();
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo guardar la cámara', message: error.message });
        }
    };

    const probar = async () => {
        setProbando(true);
        setPrueba(null);
        try {
            setPrueba(await probarCamara({ idCamara: camara.id_camara }));
        } catch (error) {
            setPrueba({ ok: false, mensaje: error.message });
        } finally {
            setProbando(false);
        }
    };

    const puedeProbar = camara && camara.tipo === 'ip' && valores.tipo === 'ip';

    return (
        <form onSubmit={enviar} noValidate className="grid gap-3" aria-label={`Cámara de ${posicion}`}>
            <h3 className="font-medium">{etiquetaPosicion(posicion)}</h3>
            {!camara && <p className="text-sm text-muted-foreground">Sin cámara configurada en esta posición.</p>}
            <Field label="Tipo">
                <Select value={valores.tipo} onChange={cambiar('tipo')} options={TIPOS} />
            </Field>
            {valores.tipo === 'ip' && (
                <Field label="Dirección IP" required error={errores.direccion_ip}>
                    <Input value={valores.direccion_ip} onChange={cambiar('direccion_ip')} inputMode="decimal" autoComplete="off" />
                </Field>
            )}
            <Field label="Estatus">
                <Select value={valores.estatus} onChange={cambiar('estatus')} options={ESTATUS_CAMARA} />
            </Field>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={guardar.loading}>
                    {camara ? 'Guardar cámara' : 'Agregar cámara'}
                </Button>
                {puedeProbar && (
                    <Button variant="secondary" loading={probando} onClick={probar}>
                        Probar
                    </Button>
                )}
            </div>
            {camara && camara.tipo === 'navegador' && (
                <p className="text-xs text-muted-foreground">La webcam del navegador se prueba al abrir la sesión de captura.</p>
            )}
            <div aria-live="polite">
                {prueba && (
                    <Alert tone={prueba.ok ? 'success' : 'danger'}>
                        {prueba.ok
                            ? `Conexión correcta${prueba.ms != null ? ` (${prueba.ms} ms)` : ''}${prueba.rostros != null ? `, rostros detectados: ${prueba.rostros}` : ''}.`
                            : prueba.mensaje || 'La cámara no respondió.'}
                    </Alert>
                )}
            </div>
        </form>
    );
}
