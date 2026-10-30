'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Asistente from '@/components/ui/Asistente';
import Switch from '@/components/ui/Switch';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { alumnoGuardar } from '@/lib/api/admin.js';
import { crearUsuario } from '@/lib/http/admin.js';
import PasswordTemporalModal from '@/components/admin/catalogos/PasswordTemporalModal';
import { CamposContacto, CamposIdentidad } from '../AlumnoForm/CamposAlumno.jsx';
import { datosAlumno, mapearErrorAlumno } from '../AlumnoForm/alumnoForm.utils.js';
import { CAMPOS_POR_PASO, descripcionDeExito, pasoDeCampo, pasosDeExito, resumenAlta, validarAlta, VALORES_ALTA } from './nuevoAlumno.utils.js';
import useMatriculaExistente from './useMatriculaExistente.js';

// El Asistente entrega `irAPaso` solo a los pasos que se están pintando. Se guarda aquí para poder volver al paso de un dato que el
// servidor rechazó cuando la persona ya está en la revisión (que no es un paso propio).
function GuardaIrAPaso({ irAPaso, destinoRef }) {
    useEffect(() => {
        destinoRef.current = irAPaso;
    });
    return null;
}

// Alta de alumno en pasos (Identidad -> Contacto y acceso -> Revisión) y pantalla de éxito con los siguientes pasos reales.
// Llama a las MISMAS RPC de siempre: api_alumno_guardar y, si se pidió, la ruta de cuentas. El alumno nace activo (sin selector de
// estatus), así que ya no hay una segunda llamada de estatus que pueda fallar a medias; la cuenta sí es una segunda llamada, y si falla
// el alumno ya existe: se dice con claridad y se ofrece reintentar, nunca «No se pudo guardar».
export default function AltaAlumno({ onOtro }) {
    const router = useRouter();
    const irAPaso = useRef(null);
    const [resultado, setResultado] = useState(null);
    const [credencial, setCredencial] = useState(null);
    const [creandoCuenta, setCreandoCuenta] = useState(false);

    // «Ya existe» llega de una consulta que depende de lo escrito en el formulario, y el formulario necesita ese resultado para validar:
    // el estado se ajusta durante el render (patrón de React para derivar estado) en vez de con un efecto.
    const [duplicada, setDuplicada] = useState(null);
    const validar = useCallback((v) => validarAlta(v, duplicada), [duplicada]);
    const f = useFormulario({ inicial: VALORES_ALTA, validar });
    const existencia = useMatriculaExistente(f.valores.matricula);
    const hallada = existencia.estado === 'duplicada' ? existencia.alumno : null;
    if ((hallada?.id_alumno ?? null) !== (duplicada?.id_alumno ?? null)) setDuplicada(hallada);

    const finalizar = async (valores) => {
        let alumno;
        try {
            alumno = await alumnoGuardar({ datos: datosAlumno(valores) });
        } catch (error) {
            const campos = mapearErrorAlumno(error);
            if (!campos) throw error;
            f.fijarErrores(campos);
            irAPaso.current?.(pasoDeCampo(Object.keys(campos)[0]));
            throw new Error('Corrige el dato marcado y vuelve a intentarlo.');
        }
        let cuenta = null;
        let errorCuenta = null;
        if (valores.crearCuenta) {
            try {
                const r = await crearUsuario({ correo: alumno.correo_institucional, rol: 'alumno', idAlumno: alumno.id_alumno });
                cuenta = { correo: r.correo };
                setCredencial({ correo: r.correo, contrasena: r.contrasena_temporal });
            } catch (error) {
                errorCuenta = error.message;
            }
        }
        const r = { alumno, cuenta, errorCuenta };
        setResultado(r);
        return r;
    };

    const crearCuentaAhora = async () => {
        if (creandoCuenta || !resultado) return;
        setCreandoCuenta(true);
        try {
            const { alumno } = resultado;
            const r = await crearUsuario({ correo: alumno.correo_institucional, rol: 'alumno', idAlumno: alumno.id_alumno });
            setCredencial({ correo: r.correo, contrasena: r.contrasena_temporal });
            setResultado((previo) => ({ ...previo, cuenta: { correo: r.correo }, errorCuenta: null }));
        } catch (error) {
            setResultado((previo) => ({ ...previo, errorCuenta: error.message }));
        } finally {
            setCreandoCuenta(false);
        }
    };

    // `creado` es lo que devolvió finalizar; el estado propio manda porque la cuenta puede crearse o reintentarse ya en la pantalla de éxito.
    const exito = (creado) => {
        const { alumno, cuenta, errorCuenta } = resultado ?? creado;
        return {
            title: 'Alumno creado',
            description: descripcionDeExito(alumno, cuenta),
            steps: pasosDeExito({ alumno, cuenta, errorCuenta, onCrearCuenta: crearCuentaAhora }),
            actions: [
                { label: 'Ir a la ficha', href: `/admin/alumnos/${alumno.id_alumno}` },
                { label: 'Crear otro alumno', onClick: onOtro },
            ],
        };
    };

    const campoPasos = (id) => f.validarCampos(CAMPOS_POR_PASO[id]) || f.erroresDe(CAMPOS_POR_PASO[id]);

    const pasos = [
        {
            id: 'identidad',
            titulo: 'Identidad',
            descripcion: 'Su matrícula y cómo se llama.',
            contenido: ({ irAPaso: ir }) => (
                <>
                    <GuardaIrAPaso irAPaso={ir} destinoRef={irAPaso} />
                    <div className="@container">
                        <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
                            <CamposIdentidad f={f} matricula={existencia} />
                        </div>
                    </div>
                </>
            ),
        },
        {
            id: 'contacto',
            titulo: 'Contacto y acceso',
            descripcion: 'Su correo institucional y, si quieres, su cuenta para entrar.',
            contenido: ({ irAPaso: ir }) => (
                <>
                    <GuardaIrAPaso irAPaso={ir} destinoRef={irAPaso} />
                    <div className="@container flex flex-col gap-5">
                        <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
                            <CamposContacto f={f} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium">
                                Cuenta de acceso <span className="font-normal text-muted-foreground">(opcional)</span>
                            </p>
                            <div className="rounded-xl border border-border p-4">
                                <Switch
                                    label="Crear su cuenta al terminar"
                                    hint="Con ella el alumno consulta su asistencia. Se genera una contraseña temporal que verás una sola vez."
                                    checked={f.valores.crearCuenta}
                                    onChange={(valor) => f.setCampo('crearCuenta', valor)}
                                    onLabel="Se creará"
                                    offLabel="Más tarde"
                                />
                            </div>
                        </div>
                    </div>
                </>
            ),
        },
    ];

    return (
        <>
            {resultado?.errorCuenta && (
                <Alert tone="warning" title="El alumno se creó, pero su cuenta de acceso no">
                    {resultado.errorCuenta} Puedes reintentarlo abajo o desde su ficha.
                </Alert>
            )}
            <Asistente
                label="Alta de alumno"
                pasos={pasos}
                valores={f.valores}
                sucio={f.sucio}
                validarPaso={campoPasos}
                resumen={resumenAlta}
                descripcionRevision="Comprueba los datos. El alumno se crea activo; su consentimiento y su plantilla facial se registran después, desde su ficha."
                onFinalizar={finalizar}
                etiquetaFinalizar={f.valores.crearCuenta ? 'Crear alumno y su cuenta' : 'Crear alumno'}
                exito={exito}
                onCancelar={() => router.push('/admin/alumnos')}
                resumenLateral
            />
            <PasswordTemporalModal
                open={Boolean(credencial)}
                correo={credencial?.correo}
                contrasena={credencial?.contrasena}
                titulo="Cuenta de acceso creada"
                onClose={() => setCredencial(null)}
            />
        </>
    );
}
