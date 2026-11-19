'use client';

import { Camera, CalendarClock, CalendarPlus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Asistente from '@/components/ui/Asistente';
import FormSection from '@/components/ui/FormSection';
import Spinner from '@/components/ui/Spinner';
import { useApiMutation } from '@/hooks/data';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { grupoGuardar, horarioGuardar } from '@/lib/api/admin.js';
import { mensajeErrorHorario } from '../HorarioEditor/horarioEditor.utils.js';
import HorarioSemanal from '../HorarioSemanal';
import { franjasHaciaApi, horasPorSemana } from '../HorarioSemanal/horarioSemanal.utils.js';
import { plural } from '../compartido/grupos.utils.js';
import { CampoCatalogo, CampoClave, CampoPeriodo } from '../GrupoForm/CamposGrupo.jsx';
import { armarResumenGrupo, CAMPOS_PASO, datosGrupo, mapearErrorGrupo, validarGrupo, VALORES_INICIALES } from '../GrupoForm/grupoForm.utils.js';
import { useCatalogosGrupo } from '../GrupoForm/useCatalogosGrupo.js';
import { opcionPorId } from './nuevoGrupo.utils.js';

const CATALOGOS_FALTANTES = [
    { clave: 'materias', texto: 'materias', href: '/admin/materias' },
    { clave: 'docentes', texto: 'docentes activos', href: '/admin/docentes' },
    { clave: 'aulas', texto: 'aulas', href: '/admin/aulas' },
];

// Alta de grupo en 3 pasos (Materia y docente -> Aula y horario -> Revisión) sobre `ui/Asistente`. El estado de los campos vive en
// useFormulario; al final se llama a las MISMAS RPC de siempre: api_grupo_guardar y, si hay horario, api_horario_guardar.
//
// FALLO PARCIAL: son dos llamadas. Si el grupo se creó pero el horario falla, el grupo YA EXISTE: reintentar no puede volver a crearlo
// (el servidor respondería DUPLICADO). Por eso el grupo creado se recuerda y el reintento lo ACTUALIZA por su id (api_grupo_guardar con
// id_grupo, idempotente) y solo repite el horario; el mensaje lo explica y el paso «Aula y horario» ofrece abrir el grupo.
//
// PRESELECCIÓN: `materiaInicial` y `aulaInicial` (ids de ?materia= y ?aula=, que llegan de la pantalla de éxito de materias y aulas) eligen esa
// materia o aula al abrir. Solo valen si el id existe en el catálogo cargado; si no, se ignoran sin error. Por eso, con una preselección, el
// asistente espera a que carguen los catálogos antes de montarse (así el formulario nace con los valores y no hay que corregirlos con efectos).
export default function AsistenteGrupo({ periodoInicial, materiaInicial, aulaInicial, onOtro }) {
    const catalogos = useCatalogosGrupo();
    const esperarCatalogos = (materiaInicial != null || aulaInicial != null) && catalogos.cargando;
    if (esperarCatalogos) {
        return (
            <div className="flex justify-center py-10">
                <Spinner />
            </div>
        );
    }
    return (
        <FormularioGrupo
            catalogos={catalogos}
            periodoInicial={periodoInicial}
            materia={opcionPorId(catalogos.materias.options, materiaInicial)}
            aula={opcionPorId(catalogos.aulas.options, aulaInicial)}
            onOtro={onOtro}
        />
    );
}

function FormularioGrupo({ catalogos, periodoInicial, materia, aula, onOtro }) {
    const router = useRouter();
    const guardarGrupo = useApiMutation(grupoGuardar);
    const guardarHorario = useApiMutation(horarioGuardar);
    const [grupoCreado, setGrupoCreado] = useState(null);
    const creado = useRef(null);
    // Opción elegida de cada Combobox (etiqueta y registro), para la revisión y el éxito: en modo remoto el catálogo no está completo.
    const [elegidos, setElegidos] = useState(() => ({ ...(materia ? { id_materia: materia } : {}), ...(aula ? { id_aula: aula } : {}) }));

    const f = useFormulario({
        inicial: { ...VALORES_INICIALES, periodo: periodoInicial, franjas: [], ...(materia ? { id_materia: materia.value } : {}), ...(aula ? { id_aula: aula.value } : {}) },
        validar: validarGrupo,
    });

    // Con la materia ya elegida, lo siguiente es el docente: el foco va ahí (solo al abrir).
    useEffect(() => {
        if (materia) document.querySelector('[data-campo="id_docente"] input')?.focus();
        // Solo al montar: elegir otra materia después no debe mover el foco.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const elegir = (campo, opcion) => setElegidos((prev) => ({ ...prev, [campo]: opcion }));

    // true = avanza; si no, { campo: mensaje } (incluye lo que el servidor rechazó antes y aún no se corrigió).
    const validarPaso = (id) => {
        const campos = CAMPOS_PASO[id];
        if (!f.validarCampos(campos)) return f.erroresDe(campos);
        const delServidor = Object.fromEntries(campos.filter((c) => f.errores[c]).map((c) => [c, f.errores[c]]));
        return Object.keys(delServidor).length === 0 ? true : delServidor;
    };

    const finalizar = async (valores) => {
        let grupo = creado.current;
        try {
            grupo = await guardarGrupo.run({ datos: datosGrupo(valores, grupo?.id_grupo) });
            creado.current = grupo;
            setGrupoCreado(grupo);
        } catch (error) {
            const campos = mapearErrorGrupo(error);
            if (campos) {
                // El error queda pegado al campo (visible al volver a su paso) y aquí se dice cómo corregirlo.
                f.fijarErrores(campos);
                throw new Error(`${error.message} Corrígelo con «Editar» y vuelve a intentarlo.`);
            }
            throw error;
        }
        const bloques = franjasHaciaApi(valores.franjas);
        let horario = [];
        if (bloques.length > 0) {
            try {
                horario = (await guardarHorario.run({ idGrupo: grupo.id_grupo, bloques }))?.bloques ?? [];
            } catch (error) {
                throw new Error(
                    `El grupo ${grupo.clave_grupo} ya se creó, pero su horario no se guardó: ${mensajeErrorHorario(error)} ` +
                        'Corrígelo con «Editar» en «Horario» y pulsa «Guardar horario»: no se creará otro grupo.',
                );
            }
        }
        return { grupo, horario };
    };

    const exito = ({ grupo, horario }) => {
        const aula = elegidos.id_aula?.datos;
        const camarasActivas = aula?.camaras_activas ?? 0;
        const base = `/admin/grupos/${grupo.id_grupo}`;
        const franjas = f.valores.franjas;
        const detalle = [elegidos.id_materia?.label, `aula ${grupo.aula_clave ?? aula?.clave ?? ''}`.trim(), `periodo ${grupo.periodo}`];
        if (horario.length > 0) detalle.push(`${horasPorSemana(franjas)} por semana`);
        return {
            title: `Grupo ${grupo.clave_grupo} creado`,
            description: detalle.filter(Boolean).join(' · '),
            steps: [
                horario.length > 0
                    ? { label: 'Generar las sesiones', description: 'Crea las clases del periodo a partir del horario.', href: `${base}?tab=horario`, icon: CalendarPlus, recommended: true }
                    : { label: 'Armar el horario', description: 'Sin horario no se pueden generar sesiones.', href: `${base}?tab=horario`, icon: CalendarClock, recommended: true },
                { label: 'Inscribir alumnos', description: 'Uno por uno o importando un CSV.', href: `${base}?tab=inscripciones`, icon: UserPlus },
                camarasActivas > 0
                    ? { label: 'Cámara del aula', description: `El aula ${aula.clave} ya tiene ${plural(camarasActivas, 'cámara activa', 'cámaras activas')}.`, done: true }
                    : { label: 'Configurar la cámara del aula', description: `${aula ? `El aula ${aula.clave} no` : 'El aula no'} tiene cámaras activas: el pase de lista sería manual.`, href: `${base}?tab=aula`, icon: Camera },
            ],
            actions: [
                { label: 'Ver el grupo', href: base },
                { label: 'Crear otro grupo', onClick: onOtro, variant: 'secondary' },
                { label: 'Ir a la lista', href: '/admin/grupos', variant: 'ghost' },
            ],
        };
    };

    const faltantes = CATALOGOS_FALTANTES.filter((c) => catalogos[c.clave].vacio);

    const pasoDatos = (
        <div className="flex flex-col gap-4">
            {catalogos.error && (
                <Alert tone="danger" compact title="No se pudieron cargar los catálogos">
                    {catalogos.error.message}
                </Alert>
            )}
            {faltantes.length > 0 && (
                <Alert tone="warning" compact title="Faltan datos para crear un grupo">
                    Registra primero:{' '}
                    {faltantes.map((c, i) => (
                        <span key={c.clave}>
                            {i > 0 && ', '}
                            <Link href={c.href} className="font-medium underline">
                                {c.texto}
                            </Link>
                        </span>
                    ))}
                    .
                </Alert>
            )}
            <CampoCatalogo f={f} nombre="id_materia" label="Materia" catalogo={catalogos.materias} placeholder="Busca por nombre o clave" onElegir={elegir} emptyText="No hay materias registradas" />
            <CampoCatalogo f={f} nombre="id_docente" label="Docente" catalogo={catalogos.docentes} placeholder="Busca por nombre o empleado" onElegir={elegir} emptyText="No hay docentes activos" />
            <div className="grid gap-4 sm:grid-cols-2">
                <CampoClave f={f} />
                <CampoPeriodo f={f} sugerido={periodoInicial} />
            </div>
        </div>
    );

    const pasoAula = (
        <div className="flex flex-col gap-6">
            {grupoCreado && (
                <Alert tone="warning" compact title={`El grupo ${grupoCreado.clave_grupo} ya está creado`}>
                    Falta guardar su horario. Corrígelo aquí y pulsa «Guardar horario», o{' '}
                    <Link href={`/admin/grupos/${grupoCreado.id_grupo}?tab=horario`} className="font-medium underline">
                        abre el grupo
                    </Link>{' '}
                    y termina desde su pestaña Horario.
                </Alert>
            )}
            <CampoCatalogo f={f} nombre="id_aula" label="Aula" catalogo={catalogos.aulas} placeholder="Busca por clave o edificio" hint="La capacidad del aula limita cuántos alumnos se pueden inscribir." onElegir={elegir} emptyText="No hay aulas registradas" />
            <FormSection title="Horario semanal" optional description="Elige los días y la hora de cada franja. Si lo dejas para después, podrás armarlo desde el grupo.">
                <HorarioSemanal
                    value={f.valores.franjas}
                    onChange={(franjas) => f.setCampo('franjas', franjas)}
                    vacioValido
                    mostrarPendientes={Boolean(f.errores.franjas)}
                    horasMateria={elegidos.id_materia?.datos?.horas_semana}
                />
            </FormSection>
        </div>
    );

    return (
        <Asistente
            label="Alta de grupo"
            pasos={[
                { id: 'datos', titulo: 'Materia y docente', descripcion: 'Qué se imparte, quién lo imparte y cómo se identifica el grupo.', contenido: pasoDatos },
                { id: 'aula', titulo: 'Aula y horario', descripcion: 'Dónde y cuándo se imparte. El horario puedes dejarlo para después.', contenido: pasoAula },
            ]}
            valores={f.valores}
            sucio={f.sucio}
            validarPaso={validarPaso}
            resumen={(v) => armarResumenGrupo(v, elegidos)}
            onFinalizar={finalizar}
            etiquetaFinalizar={grupoCreado ? 'Guardar horario' : 'Crear grupo'}
            exito={exito}
            onCancelar={() => router.push('/admin/grupos')}
            resumenLateral
        />
    );
}
