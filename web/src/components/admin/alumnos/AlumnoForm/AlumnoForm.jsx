'use client';

import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import FormSection from '@/components/ui/FormSection';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { CamposContacto, CamposIdentidad } from './CamposAlumno.jsx';
import {
    datosAlumno, ESTATUS_ALUMNO, hayCambiosDeDatos, mapearErrorAlumno, validarAlumno, valoresDeAlumno,
} from './alumnoForm.utils.js';

const textoAvisoBaja = (n) => {
    if (n === 0) return 'No tiene inscripciones activas que dar de baja.';
    if (typeof n === 'number') return `Al guardar, se darán de baja sus ${n} ${n === 1 ? 'inscripción activa' : 'inscripciones activas'}.`;
    return 'Al guardar, se darán de baja sus inscripciones activas.';
};

// Quien llama devuelve `false` para decir «no se guardó nada» (p. ej. la persona canceló la confirmación de la baja): el formulario
// conserva lo escrito y sigue marcando «cambios sin guardar». Se modela como un error propio para no marcar lo enviado como guardado.
const NO_GUARDADO = new Error('No se guardó');

// Datos del alumno (RF-01). Sin `alumno` es un alta simple; con `alumno`, la edición de la ficha, que agrega la sección «Estado».
//   inscripcionesActivas  cuántas tiene hoy (la ficha lo sabe): hace exacto el aviso de la baja.
//   onSubmit({ datos, estatus, cambioDatos, cambioEstatus }) -> promesa. Si lanza, el error se pega al campo que lo causó (matrícula o
//   correo duplicados…) o, si es general, se muestra junto a los botones; lo escrito se conserva. Si devuelve `false`, no se guardó nada.
// El alta con pasos es NuevoAlumno (Asistente); aquí los mismos campos van en secciones.
export default function AlumnoForm({ alumno, onSubmit, loading = false, submitLabel = 'Guardar', inscripcionesActivas }) {
    const edicion = Boolean(alumno);
    const f = useFormulario({
        inicial: valoresDeAlumno(alumno),
        validar: validarAlumno,
        mapearError: mapearErrorAlumno,
        onSubmit: async (v) => {
            const resultado = await onSubmit?.({
                datos: datosAlumno(v, alumno?.id_alumno),
                estatus: v.estatus,
                cambioDatos: hayCambiosDeDatos(v, alumno),
                cambioEstatus: edicion && v.estatus !== alumno.estatus,
            });
            if (resultado === false) throw NO_GUARDADO;
        },
    });
    useCambiosSinGuardar(edicion && f.sucio);

    const estatus = f.campo('estatus');
    const errorGeneral = f.errorEnvio && f.errorEnvio !== NO_GUARDADO ? f.errorEnvio : null;
    const daDeBaja = edicion && alumno.estatus === 'activo' && f.valores.estatus !== 'activo';
    const reactiva = edicion && alumno.estatus !== 'activo' && f.valores.estatus === 'activo';

    return (
        <form onSubmit={f.enviar} noValidate aria-label="Datos del alumno" className="flex flex-col gap-6">
            <FormSection title="Identidad" columns={2}>
                <CamposIdentidad f={f} />
            </FormSection>
            <FormSection title="Contacto" description="Con este correo el alumno entra a consultar su asistencia." columns={2}>
                <CamposContacto f={f} />
            </FormSection>
            {edicion && (
                <FormSection title="Estado" description="Una baja o un egreso conserva todo el historial del alumno.">
                    <div className="flex flex-col gap-2">
                        <SegmentedControl
                            label="Estatus del alumno"
                            items={ESTATUS_ALUMNO}
                            value={f.valores.estatus}
                            onChange={(valor) => f.setCampo('estatus', valor)}
                            name={estatus.name}
                            fullWidth
                        />
                        {daDeBaja && (
                            <Alert tone="warning" compact>
                                {textoAvisoBaja(inscripcionesActivas)}
                            </Alert>
                        )}
                        {reactiva && (
                            <Alert tone="info" compact>
                                Reactivarlo no restituye sus inscripciones: habrá que inscribirlo de nuevo en cada grupo.
                            </Alert>
                        )}
                    </div>
                </FormSection>
            )}
            {errorGeneral && (
                <Alert tone="danger" compact title="No se pudo guardar">
                    {errorGeneral.message}
                </Alert>
            )}
            <FormActions dirty={edicion ? f.cambios : false} motivoBloqueo={edicion && !f.sucio ? 'Aún no hay cambios que guardar.' : undefined}>
                {edicion && f.sucio && (
                    <Button variant="secondary" onClick={() => f.reiniciar()} disabled={f.enviando}>
                        Descartar
                    </Button>
                )}
                <Button type="submit" loading={f.enviando || loading} disabled={edicion && !f.sucio}>
                    {submitLabel}
                </Button>
            </FormActions>
        </form>
    );
}
