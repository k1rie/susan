'use client';

import { useId, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { registrarManual } from '@/lib/api/sesiones.js';
import { motivoRegistroManual, requiereRegistroManual, sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';

// Siempre texto + color; el segmentado agrega la palomita al elegir.
const ESTADOS = [
    { value: 'presente', label: 'Presente', tone: 'presente' },
    { value: 'retardo', label: 'Retardo', tone: 'retardo' },
    { value: 'ausente', label: 'Ausente', tone: 'ausente' },
];
const ETIQUETA = Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]));

// Registro manual de un alumno (RF-09) en sesión automática: solo sin consentimiento vigente o sin lecturas válidas.
// El estado sugerido sale del minuto de la sesión; la hora la fija el servidor.
//   alumno = fila de la tabla que se quiere registrar (queda fijo); sin él se elige con búsqueda.
// «Guardar y registrar otro» deja el diálogo abierto para quien tiene varios alumnos sin consentimiento: se elige, se toca y sigue.
export default function RegistroManualDialog({ open, sesion, alumnos = [], alumno = null, onClose, onGuardado }) {
    const { toast } = useToast();
    const { run, loading } = useApiMutation(registrarManual);
    const idForm = useId();
    const idCampoAlumno = useId();
    const sugerido = sugerirEstado(sesion);
    const [idElegido, setIdElegido] = useState('');
    const [estado, setEstado] = useState(sugerido);
    const [yaRegistrados, setYaRegistrados] = useState([]); // el monitor tarda en refrescarse: no se vuelven a ofrecer
    const [errorAlumno, setErrorAlumno] = useState('');
    const [errorEnvio, setErrorEnvio] = useState('');
    const [ultimo, setUltimo] = useState(null); // { nombre, estado } del «otro» recién registrado

    const elegibles = alumnos.filter((a) => requiereRegistroManual(a) && !yaRegistrados.includes(a.id_alumno));
    const opciones = elegibles.map((a) => ({
        value: String(a.id_alumno),
        label: a.nombre,
        description: `${a.matricula} · ${motivoRegistroManual(a) ?? 'Registro manual'}`,
        avatar: a.nombre,
    }));
    const elegido = elegibles.find((a) => String(a.id_alumno) === idElegido) ?? null;
    const idAlumno = alumno?.id_alumno ?? elegido?.id_alumno ?? null;
    const sinPendientes = !alumno && elegibles.length === 0;

    const guardar = async ({ otro }) => {
        if (!idAlumno) {
            setErrorAlumno('Elige al alumno que quieres registrar.');
            document.getElementById(idCampoAlumno)?.focus();
            return;
        }
        setErrorEnvio('');
        const nombre = alumno?.nombre ?? elegido?.nombre ?? '';
        try {
            await run({ idSesion: sesion.id_sesion, idAlumno, estado });
        } catch (err) {
            // Se conserva lo elegido y el error queda a la vista dentro del diálogo (un solo aviso, no toast más diálogo).
            setErrorEnvio(err.message);
            return;
        }
        onGuardado?.();
        if (otro) {
            setYaRegistrados((previos) => [...previos, idAlumno]);
            setUltimo({ nombre, estado });
            setIdElegido('');
            setEstado(sugerido);
            setErrorAlumno('');
            document.getElementById(idCampoAlumno)?.focus();
            return;
        }
        toast({ tone: 'success', title: 'Asistencia registrada', message: 'El registro quedó con origen manual.' });
        onClose?.();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Registrar manualmente"
            size="sm"
            showClose
            closeDisabled={loading}
            footer={({ cerrar }) => (
                // En teléfono «Guardar y registrar otro» ocupa la primera fila completa y Cancelar/Guardar se reparten debajo (tres botones en
                // una línea no caben a 360 px); desde `sm` quedan en una sola fila, en el orden de lectura.
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Button variant="secondary" onClick={cerrar} disabled={loading} className={sinPendientes ? 'col-span-2' : undefined}>
                        {sinPendientes ? 'Cerrar' : 'Cancelar'}
                    </Button>
                    {!alumno && !sinPendientes && (
                        <Button variant="secondary" onClick={() => guardar({ otro: true })} disabled={loading} className="order-first col-span-2 sm:order-none sm:col-span-1">
                            Guardar y registrar otro
                        </Button>
                    )}
                    {!sinPendientes && (
                        <Button type="submit" form={idForm} loading={loading}>
                            Guardar
                        </Button>
                    )}
                </div>
            )}
        >
            <form
                id={idForm}
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    guardar({ otro: false });
                }}
                className="flex flex-col gap-4"
            >
                {ultimo && (
                    <Alert tone="success" compact>
                        Registrado: <strong>{ultimo.nombre}</strong> como {ETIQUETA[ultimo.estado]}.
                    </Alert>
                )}
                {errorEnvio && (
                    <Alert tone="danger" compact title="No se pudo registrar">
                        {errorEnvio}
                    </Alert>
                )}
                {alumno ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                        <Avatar nombre={alumno.nombre} />
                        <p className="min-w-0 text-sm">
                            <span className="block truncate font-medium">{alumno.nombre}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {alumno.matricula}
                                {motivoRegistroManual(alumno) ? ` · ${motivoRegistroManual(alumno)}` : ''}
                            </span>
                        </p>
                    </div>
                ) : sinPendientes ? (
                    <p className="text-sm text-muted-foreground">
                        {ultimo ? 'Ya no quedan alumnos por registrar a mano.' : 'Todos los alumnos ya tienen lecturas válidas con consentimiento vigente.'}
                    </p>
                ) : (
                    <Field
                        label="Alumno"
                        required
                        error={errorAlumno}
                        hint={`${elegibles.length === 1 ? '1 alumno puede' : `${elegibles.length} alumnos pueden`} registrarse a mano: sin consentimiento vigente o sin lecturas válidas.`}
                    >
                        <Combobox
                            id={idCampoAlumno}
                            options={opciones}
                            value={idElegido}
                            onChange={(valor) => {
                                setIdElegido(valor);
                                setErrorAlumno('');
                            }}
                            placeholder="Busca por nombre o matrícula"
                            emptyText="Ningún alumno coincide"
                            clearable
                            invalid={Boolean(errorAlumno)}
                        />
                    </Field>
                )}
                {!sinPendientes && (
                    <Field as="fieldset" label="Estado" required hint={`Sugerido según la hora: ${ETIQUETA[sugerido]}.`}>
                        <SegmentedControl items={ESTADOS} value={estado} onChange={setEstado} fullWidth />
                    </Field>
                )}
            </form>
        </Modal>
    );
}
