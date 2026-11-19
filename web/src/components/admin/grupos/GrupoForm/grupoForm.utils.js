// Validación y datos del formulario de grupo (el servidor revalida: duplicados, docente activo, historial, choques de horario).
import { hoyLocal, partesFecha } from '@/lib/formularios/fechas.js';
import { PATRONES } from '@/lib/formularios/limites.js';
import { etiquetaDias, etiquetaHoras, horasPorSemana, totalMinutos, validarFranjas } from '../HorarioSemanal/horarioSemanal.utils.js';
import { etiquetaEdificio, plural } from '../compartido/grupos.utils.js';

export const PERIODO_RE = PATRONES.periodo;
export const CLAVE_RE = PATRONES.clave_grupo;

export const VALORES_INICIALES = { id_materia: '', id_docente: '', id_aula: '', clave_grupo: '', periodo: '' };

// Campos de cada paso del alta (para validar solo el paso que se cierra).
export const CAMPOS_PASO = { datos: ['id_materia', 'id_docente', 'clave_grupo', 'periodo'], aula: ['id_aula', 'franjas'] };

/** Periodo AAAA-S de una fecha: enero a junio es el semestre 1 y julio a diciembre el 2. Es solo una sugerencia editable. */
export function periodoSugerido(hoy = hoyLocal()) {
    const p = partesFecha(hoy);
    if (!p) return '';
    return `${p.anio}-${p.mes <= 6 ? 1 : 2}`;
}

/** Desplaza un periodo AAAA-S `n` semestres (2026-2 + 1 = 2027-1). */
export function desplazarPeriodo(periodo, n) {
    const m = /^(\d{4})-([12])$/.exec(String(periodo ?? ''));
    if (!m) return '';
    const indice = Number(m[1]) * 2 + (Number(m[2]) - 1) + n;
    return `${Math.floor(indice / 2)}-${(indice % 2) + 1}`;
}

/** Periodos para el selector del listado: el siguiente, el vigente y los tres anteriores (más recientes primero). */
export function periodosCercanos(hoy = hoyLocal()) {
    const actual = periodoSugerido(hoy);
    if (!actual) return [];
    return [1, 0, -1, -2, -3].map((n) => desplazarPeriodo(actual, n));
}

export function validarGrupo(v) {
    const e = {};
    if (!v.id_materia) e.id_materia = 'Elige la materia.';
    if (!v.id_docente) e.id_docente = 'Elige el docente.';
    if (!v.id_aula) e.id_aula = 'Elige el aula.';
    const clave = String(v.clave_grupo || '').trim().toUpperCase();
    if (!clave) e.clave_grupo = 'Escribe la clave del grupo, por ejemplo 3A.';
    else if (!CLAVE_RE.test(clave)) e.clave_grupo = 'Usa hasta 8 letras, dígitos o guiones, por ejemplo 3A.';
    const periodo = String(v.periodo || '').trim();
    if (!periodo) e.periodo = 'Escribe el periodo, por ejemplo 2026-2.';
    else if (!PERIODO_RE.test(periodo)) e.periodo = 'Usa el formato AAAA-S, donde S es 1 o 2 (por ejemplo 2026-2).';
    // En el alta el horario es opcional, pero lo que se capture debe ser coherente.
    if (Array.isArray(v.franjas) && !validarFranjas(v.franjas, { vacioValido: true }).valido) e.franjas = 'Revisa las franjas del horario: hay campos por corregir.';
    return e;
}

export function datosGrupo(v, idGrupo) {
    const datos = {
        id_materia: Number(v.id_materia),
        id_docente: Number(v.id_docente),
        id_aula: Number(v.id_aula),
        clave_grupo: String(v.clave_grupo).trim().toUpperCase(),
        periodo: String(v.periodo).trim(),
    };
    if (idGrupo) datos.id_grupo = idGrupo;
    return datos;
}

export function valoresDeGrupo(g) {
    return {
        id_materia: String(g.id_materia ?? ''),
        id_docente: String(g.id_docente ?? ''),
        id_aula: String(g.id_aula ?? ''),
        clave_grupo: g.clave_grupo ?? '',
        periodo: g.periodo ?? '',
    };
}

/** Con inscripciones o sesiones el servidor ya no deja cambiar la materia ni el periodo (GRUPO_CON_HISTORIAL): se avisa antes de intentarlo. */
export function identidadBloqueada(grupo) {
    const inscritos = (grupo?.inscritos?.activos ?? 0) + (grupo?.inscritos?.baja ?? 0);
    return inscritos > 0 || (grupo?.sesiones?.total ?? 0) > 0;
}

/** Error del servidor -> { campo: mensaje } pegado al campo que lo causó; null si es un error general. */
export function mapearErrorGrupo(error) {
    const mensaje = error?.message;
    switch (error?.code) {
        case 'DUPLICADO':
            return { clave_grupo: mensaje || 'Ya existe un grupo con esa clave, materia y periodo.' };
        case 'PERIODO_INVALIDO':
            return { periodo: mensaje || 'El periodo debe tener el formato AAAA-S (S = 1 o 2).' };
        case 'DOCENTE_NO_ACTIVO':
            return { id_docente: mensaje || 'Ese docente no está activo.' };
        case 'HORARIO_CHOQUE':
            return { id_aula: mensaje || 'El horario del grupo choca con otro grupo del aula.' };
        default:
            return null;
    }
}

// Opciones de dos líneas para los Combobox (título + apoyo). `datos` conserva el registro para el resumen y el éxito.
export function opcionMateria(m) {
    const apoyo = [m.clave, m.horas_semana != null ? `${m.horas_semana} h por semana` : null, m.creditos != null ? plural(m.creditos, 'crédito') : null];
    return { value: String(m.id_materia), label: m.nombre, description: apoyo.filter(Boolean).join(' · '), datos: m };
}
export function opcionDocente(d) {
    return { value: String(d.id_docente), label: d.nombre_completo, description: [d.num_empleado, d.correo_institucional].filter(Boolean).join(' · '), avatar: d.nombre_completo, datos: d };
}
export function opcionAula(a) {
    const camaras = a.camaras_activas > 0 ? plural(a.camaras_activas, 'cámara activa', 'cámaras activas') : 'sin cámaras activas';
    const apoyo = [etiquetaEdificio(a.edificio) || null, a.capacidad != null ? `${a.capacidad} lugares` : null, camaras];
    return { value: String(a.id_aula), label: a.clave, description: apoyo.filter(Boolean).join(' · '), datos: a };
}

/** Secciones de la revisión (y del resumen vivo) del alta de grupo; `elegidos` trae la opción de cada Combobox. */
export function armarResumenGrupo(v, elegidos = {}) {
    const franjas = v.franjas ?? [];
    const aula = elegidos.id_aula?.datos;
    const horario = franjas.length
        ? [
              ...franjas.map((f) => ({ etiqueta: etiquetaDias(f.dias), valor: etiquetaHoras(f) })),
              { etiqueta: 'Total por semana', valor: totalMinutos(franjas) > 0 ? horasPorSemana(franjas) : '' },
          ]
        : [{ etiqueta: 'Franjas', valor: 'Sin horario por ahora (podrás armarlo después)' }];
    return [
        {
            id: 'datos',
            titulo: 'Materia y docente',
            paso: 'datos',
            filas: [
                { etiqueta: 'Materia', valor: elegidos.id_materia?.label ?? '' },
                { etiqueta: 'Docente', valor: elegidos.id_docente?.label ?? '' },
                { etiqueta: 'Clave del grupo', valor: String(v.clave_grupo ?? '').trim().toUpperCase() },
                { etiqueta: 'Periodo', valor: String(v.periodo ?? '').trim() },
            ],
        },
        {
            id: 'aula',
            titulo: 'Aula',
            paso: 'aula',
            filas: [
                { etiqueta: 'Clave', valor: elegidos.id_aula?.label ?? '' },
                { etiqueta: 'Capacidad', valor: aula?.capacidad != null ? `${aula.capacidad} lugares` : '' },
                { etiqueta: 'Cámaras activas', valor: aula ? (aula.camaras_activas > 0 ? String(aula.camaras_activas) : 'Ninguna: el pase de lista sería manual') : '' },
            ],
        },
        { id: 'horario', titulo: 'Horario', paso: 'aula', filas: horario },
    ];
}
