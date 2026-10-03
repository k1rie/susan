import {
    BellRing,
    BookOpen,
    Building2,
    CalendarClock,
    ChartLine,
    ClipboardCheck,
    FileBarChart,
    GraduationCap,
    HeartHandshake,
    LayoutDashboard,
    Megaphone,
    NotebookPen,
    Presentation,
    ScanFace,
    ScrollText,
    Sparkles,
    UserCheck,
    UserCog,
    Users,
    Wrench,
} from 'lucide-react';

// =============================================================================================================
// Registro de módulos de SUSAN: UNA fuente para el Home por rol, la paleta de comandos, la página /modulos y la
// barra lateral ("Próximamente"). Agregar una función futura = agregar una entrada aquí con estado 'pronto' (y
// pasarla a 'activo' + href cuando exista la pantalla). Ver docs/design/MODULOS.md.
//
//   id           único, en minúsculas y con guiones; es el segmento de /modulos/[id]
//   titulo       nombre corto (tarjeta, paleta)
//   descripcion  una frase (tarjeta); queIncluye = lista corta de lo que traerá (solo 'pronto')
//   categoria    asistencia | analisis | administracion
//   roles        quién lo ve (los mismos valores de api_yo().rol)
//   estado       'activo' (tiene href) | 'pronto' (página "Próximamente", sin href)
//   tono         paleta de la ilustración: azul | dorado | verde | violeta
// =============================================================================================================

export const CATEGORIAS = [
    { id: 'asistencia', etiqueta: 'Asistencia' },
    { id: 'analisis', etiqueta: 'Análisis' },
    { id: 'administracion', etiqueta: 'Administración' },
];

export const TONOS = ['azul', 'dorado', 'verde', 'violeta'];
export const ESTADOS = ['activo', 'pronto'];
export const ROLES = ['administrador', 'docente', 'alumno', 'tecnico'];

export const MODULOS = [
    // ---- Activos: docente ----
    { id: 'panel-docente', titulo: 'Mi panel', descripcion: 'Sesiones de hoy, pendientes de revisión y alertas de asistencia de tus grupos.', icono: LayoutDashboard, categoria: 'asistencia', roles: ['docente'], estado: 'activo', href: '/docente', tono: 'azul' },
    { id: 'revision', titulo: 'Revisión de registros', descripcion: 'Confirma o corrige los reconocimientos dudosos y los alumnos sin lectura.', icono: ClipboardCheck, categoria: 'asistencia', roles: ['docente'], estado: 'activo', href: '/docente/revision', tono: 'dorado' },
    // ---- Activos: docente y administración ----
    { id: 'reportes', titulo: 'Reportes', descripcion: 'Asistencia por periodo, grupo y alumno; exporta a CSV o PDF.', icono: FileBarChart, categoria: 'asistencia', roles: ['docente', 'administrador'], estado: 'activo', href: '/reportes', tono: 'verde' },
    { id: 'analitica', titulo: 'Analítica de ausentismo', descripcion: 'Tendencia, proyección y riesgo con métodos numéricos para intervenir a tiempo.', icono: ChartLine, categoria: 'analisis', roles: ['docente', 'administrador'], estado: 'activo', href: '/analitica', tono: 'violeta' },
    // ---- Activos: alumno ----
    { id: 'mi-asistencia', titulo: 'Mi asistencia', descripcion: 'Tu historial por materia, el límite de faltas para examen y tus justificantes.', icono: UserCheck, categoria: 'asistencia', roles: ['alumno'], estado: 'activo', href: '/alumno', tono: 'azul' },
    // ---- Activos: administración ----
    { id: 'resumen-admin', titulo: 'Resumen del periodo', descripcion: 'Contadores del periodo: alumnos, grupos, sesiones, cámaras y consentimientos.', icono: LayoutDashboard, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin', tono: 'azul' },
    { id: 'grupos', titulo: 'Grupos y horarios', descripcion: 'Grupos del periodo, inscripciones, horarios y cámaras por aula.', icono: Users, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/grupos', tono: 'dorado' },
    { id: 'alumnos', titulo: 'Alumnos', descripcion: 'Expediente, plantilla facial y consentimiento informado.', icono: GraduationCap, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/alumnos', tono: 'azul' },
    { id: 'docentes', titulo: 'Docentes', descripcion: 'Alta y baja de docentes y sus cuentas de acceso.', icono: Presentation, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/docentes', tono: 'verde' },
    { id: 'materias', titulo: 'Materias', descripcion: 'Catálogo de materias, créditos y plan de estudios.', icono: BookOpen, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/materias', tono: 'violeta' },
    { id: 'aulas', titulo: 'Aulas', descripcion: 'Aulas, capacidad y cámaras instaladas.', icono: Building2, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/aulas', tono: 'dorado' },
    { id: 'usuarios', titulo: 'Usuarios', descripcion: 'Cuentas de acceso, roles, activación y restablecimiento de contraseña.', icono: UserCog, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/usuarios', tono: 'azul' },
    { id: 'bitacora', titulo: 'Bitácora', descripcion: 'Registro de auditoría de correcciones, justificantes y consultas biométricas.', icono: ScrollText, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/admin/bitacora', tono: 'verde' },
    { id: 'sistema', titulo: 'Sistema (solo consulta)', descripcion: 'Estado de cámaras, parámetros del sistema e índice facial.', icono: Wrench, categoria: 'administracion', roles: ['administrador'], estado: 'activo', href: '/tecnico', tono: 'violeta' },
    // ---- Activos: técnico ----
    { id: 'consola-tecnica', titulo: 'Consola técnica', descripcion: 'Cámaras, parámetros del sistema e índice facial.', icono: Wrench, categoria: 'administracion', roles: ['tecnico'], estado: 'activo', href: '/tecnico', tono: 'violeta' },

    // ---- Próximamente (hoja de ruta; textos provisionales, ajustables sin tocar pantallas) ----
    {
        id: 'asistente', titulo: 'Asistente SUSAN', descripcion: 'Pregunta en lenguaje natural por el ausentismo de tus grupos y recibe un resumen con acciones sugeridas.',
        icono: Sparkles, categoria: 'analisis', roles: ['docente', 'administrador'], estado: 'pronto', tono: 'violeta',
        queIncluye: ['Resumen semanal del grupo en lenguaje claro', 'Borradores de mensaje para alumnos en riesgo', 'Explicación del cálculo de riesgo, paso a paso'],
    },
    {
        id: 'tutorias', titulo: 'Tutorías y seguimiento', descripcion: 'Abre un caso por alumno en riesgo, registra acuerdos y da seguimiento hasta cerrarlo.',
        icono: HeartHandshake, categoria: 'asistencia', roles: ['docente', 'administrador'], estado: 'pronto', tono: 'dorado',
        queIncluye: ['Casos abiertos a partir de las alertas de asistencia', 'Acuerdos y fechas de seguimiento', 'Historial de intervención por alumno'],
    },
    {
        id: 'comunicados', titulo: 'Comunicados', descripcion: 'Avisos a grupos y alumnos, y recordatorios al acercarse al límite de faltas.',
        icono: Megaphone, categoria: 'asistencia', roles: ['docente', 'administrador', 'alumno'], estado: 'pronto', tono: 'azul',
        queIncluye: ['Avisos por grupo con acuse de lectura', 'Recordatorio automático al llegar al 80 % del límite de faltas', 'Plantillas institucionales'],
    },
    {
        id: 'calificaciones', titulo: 'Calificaciones', descripcion: 'Evaluaciones ligadas a la asistencia: derecho a examen y promedio en un solo lugar.',
        icono: NotebookPen, categoria: 'asistencia', roles: ['docente', 'alumno'], estado: 'pronto', tono: 'verde',
        queIncluye: ['Captura de evaluaciones por parcial', 'Derecho a examen calculado con la asistencia', 'Boleta del alumno'],
    },
    {
        id: 'horarios', titulo: 'Horarios inteligentes', descripcion: 'Propón horarios y aulas sin empalmes usando la ocupación real.',
        icono: CalendarClock, categoria: 'administracion', roles: ['administrador'], estado: 'pronto', tono: 'dorado',
        queIncluye: ['Detección de empalmes de docente, grupo y aula', 'Propuestas con base en la ocupación real', 'Exportación del horario oficial'],
    },
    {
        id: 'acceso-campus', titulo: 'Acceso al campus', descripcion: 'Reconocimiento facial en accesos con las mismas reglas de privacidad.',
        icono: ScanFace, categoria: 'administracion', roles: ['administrador', 'tecnico'], estado: 'pronto', tono: 'violeta',
        queIncluye: ['Registro de entradas y salidas', 'Mismo consentimiento y bitácora que el pase de lista', 'Alertas por intentos no reconocidos'],
    },
    {
        id: 'notificaciones', titulo: 'Notificaciones', descripcion: 'Avisos por correo cuando cambia una sesión, un justificante o un riesgo.',
        icono: BellRing, categoria: 'asistencia', roles: ['docente', 'alumno', 'administrador'], estado: 'pronto', tono: 'azul',
        queIncluye: ['Preferencias por tipo de aviso', 'Resumen diario opcional', 'Enlaces directos al caso'],
    },
];

export const puedeVer = (modulo, rol) => modulo.roles.includes(rol);
export const modulosParaRol = (rol) => MODULOS.filter((m) => puedeVer(m, rol));
export const modulosActivos = (rol) => modulosParaRol(rol).filter((m) => m.estado === 'activo');
export const modulosProximos = (rol) => modulosParaRol(rol).filter((m) => m.estado === 'pronto');
export const buscarModulo = (id) => MODULOS.find((m) => m.id === id) ?? null;

// Filtros de /modulos: «todos», una categoría o «pronto». Devuelve [{ id, etiqueta, total }] solo con los no vacíos.
export function filtrosDeModulos(modulos) {
    const filtros = [
        { id: 'todos', etiqueta: 'Todos', total: modulos.length },
        ...CATEGORIAS.map((c) => ({ id: c.id, etiqueta: c.etiqueta, total: modulos.filter((m) => m.estado === 'activo' && m.categoria === c.id).length })),
        { id: 'pronto', etiqueta: 'Próximamente', total: modulos.filter((m) => m.estado === 'pronto').length },
    ];
    return filtros.filter((f) => f.id === 'todos' || f.total > 0);
}

export function aplicarFiltro(modulos, filtro) {
    if (filtro === 'pronto') return modulos.filter((m) => m.estado === 'pronto');
    if (filtro === 'todos' || !filtro) return modulos;
    return modulos.filter((m) => m.estado === 'activo' && m.categoria === filtro);
}
