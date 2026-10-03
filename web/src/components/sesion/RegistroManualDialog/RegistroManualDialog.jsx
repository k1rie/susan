'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { registrarManual } from '@/lib/api/sesiones.js';
import { requiereRegistroManual, sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';

const ESTADOS = [
    { value: 'presente', label: 'Presente' },
    { value: 'retardo', label: 'Retardo' },
    { value: 'ausente', label: 'Ausente' },
];

// Registro manual de un alumno (RF-09) en sesion automatica: solo sin consentimiento vigente o sin lecturas validas.
// El estado sugerido sale del minuto de la sesion; la hora la fija el servidor.
export default function RegistroManualDialog({ open, sesion, alumnos = [], alumno = null, onClose, onGuardado }) {
    const { toast } = useToast();
    const { run, loading } = useApiMutation(registrarManual);
    const elegibles = alumnos.filter(requiereRegistroManual);
    const [idElegido, setIdElegido] = useState('');
    const [estado, setEstado] = useState(() => sugerirEstado(sesion));
    const idAlumno = alumno?.id_alumno ?? (idElegido ? Number(idElegido) : null);

    const guardar = async (e) => {
        e.preventDefault();
        if (!idAlumno) return;
        try {
            await run({ idSesion: sesion.id_sesion, idAlumno, estado });
            toast({ tone: 'success', title: 'Asistencia registrada', message: 'El registro quedó con origen manual.' });
            onGuardado?.();
            onClose?.();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo registrar', message: err.message });
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Registrar manualmente" size="sm">
            <form onSubmit={guardar} className="flex flex-col gap-3">
                {alumno ? (
                    <p className="text-sm">
                        Alumno: <strong>{alumno.nombre}</strong> ({alumno.matricula})
                    </p>
                ) : (
                    <label className="flex flex-col gap-1 text-sm">
                        Alumno
                        <Select value={idElegido} onChange={(e) => setIdElegido(e.target.value)} placeholder="Selecciona un alumno" options={elegibles.map((a) => ({ value: String(a.id_alumno), label: `${a.matricula} - ${a.nombre}` }))} required />
                    </label>
                )}
                {!alumno && elegibles.length === 0 && <p className="text-sm text-muted">Todos los alumnos ya tienen lecturas válidas con consentimiento vigente.</p>}
                <label className="flex flex-col gap-1 text-sm">
                    Estado (sugerido segun la hora: {ESTADOS.find((s) => s.value === sugerirEstado(sesion))?.label})
                    <Select value={estado} onChange={(e) => setEstado(e.target.value)} options={ESTADOS} />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" loading={loading} disabled={!idAlumno}>
                        Guardar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
