import {
    BookOpen,
    Building2,
    ChartLine,
    ClipboardCheck,
    FileBarChart,
    GraduationCap,
    LayoutDashboard,
    Presentation,
    ScanFace,
    ScrollText,
    UserCheck,
    UserCog,
    Users,
    Wrench,
} from 'lucide-react';

// Definición única de la navegación por rol (plataforma.md 2.5). Las sesiones no tienen ítem propio.
// El primer ítem de cada rol es su «Inicio» (va arriba, junto a Buscar); el resto se agrupa bajo `grupo` (título de sección del
// riel, como «Chats»/«Stacks» en Dropbox Dash). Un ítem SIN `grupo` queda justo debajo de «Buscar», sin título de sección: se
// reserva para la acción principal del rol («Pasar lista» del docente), que no debe esconderse dentro de un grupo.
// Iconos: SIEMPRE de Lucide.
export const NAV_POR_ROL = {
    administrador: [
        { href: '/admin', label: 'Inicio', icon: LayoutDashboard },
        { href: '/admin/grupos', label: 'Grupos', icon: Users, grupo: 'Catálogos' },
        { href: '/admin/alumnos', label: 'Alumnos', icon: GraduationCap, grupo: 'Catálogos' },
        { href: '/admin/docentes', label: 'Docentes', icon: Presentation, grupo: 'Catálogos' },
        { href: '/admin/materias', label: 'Materias', icon: BookOpen, grupo: 'Catálogos' },
        { href: '/admin/aulas', label: 'Aulas', icon: Building2, grupo: 'Catálogos' },
        { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog, grupo: 'Cuentas y auditoría' },
        { href: '/admin/bitacora', label: 'Bitácora', icon: ScrollText, grupo: 'Cuentas y auditoría' },
        { href: '/reportes', label: 'Reportes', icon: FileBarChart, grupo: 'Análisis' },
        { href: '/analitica', label: 'Analítica', icon: ChartLine, grupo: 'Análisis' },
        { href: '/tecnico', label: 'Sistema (solo consulta)', icon: Wrench, grupo: 'Sistema' },
    ],
    docente: [
        { href: '/docente', label: 'Panel', icon: LayoutDashboard },
        { href: '/docente/pasar-lista', label: 'Pasar lista', icon: ScanFace },
        { href: '/docente/revision', label: 'Revisión', icon: ClipboardCheck, grupo: 'Asistencia' },
        { href: '/reportes', label: 'Reportes', icon: FileBarChart, grupo: 'Asistencia' },
        { href: '/analitica', label: 'Analítica', icon: ChartLine, grupo: 'Análisis' },
    ],
    alumno: [{ href: '/alumno', label: 'Mi asistencia', icon: UserCheck }],
    tecnico: [{ href: '/tecnico', label: 'Consola técnica', icon: Wrench }],
};

// Acción del botón redondo central de la barra inferior móvil, por rol (un solo lugar). Forma: { href, label, icon }. Los roles que
// no aparecen aquí conservan el botón por omisión de BottomNav: «Buscar o ir a» (abre la paleta de comandos). El docente pasa lista
// a diario, así que su botón más grande y central lo lleva a /docente/pasar-lista; el buscador queda en el cajón («Más»).
export const ACCION_CENTRAL_POR_ROL = {
    docente: { href: '/docente/pasar-lista', label: 'Pasar lista', icon: ScanFace },
};

export const ROL_ETIQUETA = {
    administrador: 'Administrador',
    docente: 'Docente',
    alumno: 'Alumno',
    tecnico: 'Técnico',
};

export function navParaRol(rol) {
    return NAV_POR_ROL[rol] ?? [];
}

/** Acción central de la barra inferior para el rol, o null si usa la búsqueda por omisión. */
export function accionCentralParaRol(rol) {
    return ACCION_CENTRAL_POR_ROL[rol] ?? null;
}

export function rolEtiqueta(rol) {
    return ROL_ETIQUETA[rol] ?? rol ?? '';
}

// Ítem activo = coincidencia más larga entre pathname y href, para que /docente/revision
// no active también /docente.
export function itemActivo(items, pathname) {
    let mejor = null;
    for (const it of items) {
        const coincide = pathname === it.href || pathname.startsWith(`${it.href}/`);
        if (coincide && (!mejor || it.href.length > mejor.length)) mejor = it.href;
    }
    return mejor;
}

// Separa el «Inicio» (primer ítem) de los grupos con título, conservando el orden: { inicio, grupos: [{ grupo, items }] }.
export function agruparNav(items) {
    const [inicio, ...resto] = items;
    const grupos = [];
    for (const it of resto) {
        const nombre = it.grupo ?? '';
        let g = grupos.find((x) => x.grupo === nombre);
        if (!g) {
            g = { grupo: nombre, items: [] };
            grupos.push(g);
        }
        g.items.push(it);
    }
    return { inicio: inicio ?? null, grupos };
}
