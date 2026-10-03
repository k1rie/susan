'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import FileInput from '@/components/ui/FileInput';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/hooks/data';
import { misJustificables } from '@/lib/api/revision.js';
import useRegistrarJustificante from './useRegistrarJustificante.js';
import { ACCEPT, MAX_BYTES, MOTIVO_MAX, etiquetaJustificable } from './registrarJustificante.utils.js';

const TEXTO_FASE = { subiendo: 'Subiendo documento…', guardando: 'Registrando justificante…' };

// Formulario puro (recibe los registros justificables ya cargados).
export function FormularioJustificante({ registros, idSesionInicial = null, onRegistrado, onNoJustificable }) {
    const { toast } = useToast();
    const preseleccion = registros.some((r) => r.id_sesion === idSesionInicial) ? String(idSesionInicial) : '';
    const [idSesion, setIdSesion] = useState(preseleccion);
    const [motivo, setMotivo] = useState('');
    const [archivo, setArchivo] = useState(null);
    const h = useRegistrarJustificante({
        onRegistrado: (j) => {
            toast({ tone: 'success', message: 'Justificante enviado; tu docente lo revisará.' });
            setIdSesion(''); setMotivo(''); setArchivo(null);
            onRegistrado?.(j);
        },
        onNoJustificable,
    });

    const alEnviar = (e) => {
        e.preventDefault();
        h.enviar({ idSesion: idSesion ? Number(idSesion) : null, motivo, archivo });
    };

    return (
        <form onSubmit={alEnviar} noValidate className="flex flex-col gap-4 rounded-3xl border border-border bg-card shadow-soft p-5" aria-label="Registrar justificante">
            {h.error && <Alert tone="danger">{h.error}</Alert>}
            <Field label="Falta o retardo a justificar" required error={h.errores.idSesion}>
                <Select
                    value={idSesion}
                    onChange={(e) => setIdSesion(e.target.value)}
                    placeholder="Selecciona una sesión"
                    options={registros.map((r) => ({ value: String(r.id_sesion), label: etiquetaJustificable(r) }))}
                />
            </Field>
            <Field label="Motivo" required error={h.errores.motivo}>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MOTIVO_MAX} showCount rows={3} />
            </Field>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Documento <span aria-hidden="true" className="text-destructive">*</span></span>
                <FileInput value={archivo} onSelect={setArchivo} accept={ACCEPT} maxBytes={MAX_BYTES}
                    label="Elegir documento (PDF, JPG o PNG, máx. 5 MB)" error={h.errores.archivo} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={h.ocupado}>Enviar justificante</Button>
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{TEXTO_FASE[h.fase] || ''}</p>
            </div>
        </form>
    );
}

// Modo alumno: carga las faltas/retardos justificables con misJustificables.
export default function RegistrarJustificanteForm({ idSesion = null, registros, onRegistrado }) {
    const q = useApiQuery(misJustificables, { limit: 50 }, { enabled: !registros });
    if (registros) {
        return <FormularioJustificante registros={registros} idSesionInicial={idSesion} onRegistrado={onRegistrado} />;
    }
    return (
        <DataState loading={q.loading} error={q.error} data={q.data} onRetry={q.refetch}
            isEmpty={(d) => !(d.items || []).length}
            empty={<EmptyState title="No tienes faltas ni retardos por justificar." />}>
            {(d) => (
                <FormularioJustificante
                    registros={d.items}
                    idSesionInicial={idSesion}
                    onNoJustificable={q.refetch}
                    onRegistrado={(j) => { q.refetch(); onRegistrado?.(j); }}
                />
            )}
        </DataState>
    );
}
