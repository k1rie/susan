import {
    BookOpen,
    Building2,
    ChartLine,
    ClipboardCheck,
    FileBarChart,
    GraduationCap,
    LayoutDashboard,
    Presentation,
    ScrollText,
    UserCheck,
    UserCog,
    Users,
    Wrench,
} from 'lucide-react';

// Definición única de la navegación por rol (plataforma.md 2.5). Las sesiones no tienen ítem propio.
export const NAV_POR_ROL = {
    administrador: [
        { href: '/admin', label: 'Inicio', icon: LayoutDashboard },
        { href: '/admin/grupos', label: 'Grupos', icon: Users },
        { href: '/admin/alumnos', label: 'Alumnos', icon: GraduationCap },
        { href: '/admin/docentes', label: 'Docentes', icon: Presentation },
        { href: '/admin/materias', label: 'Materias', icon: BookOpen },
        { href: '/admin/aulas', label: 'Aulas', icon: Building2 },
        { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
        { href: '/admin/bitacora', label: 'Bitácora', icon: ScrollText },
        { href: '/reportes', label: 'Reportes', icon: FileBarChart },
        { href: '/analitica', label: 'Analítica', icon: ChartLine },
        { href: '/tecnico', label: 'Sistema (solo consulta)', icon: Wrench },
    ],
    docente: [
        { href: '/docente', label: 'Panel', icon: LayoutDashboard },
        { href: '/docente/revision', label: 'Revisión', icon: ClipboardCheck },
        { href: '/reportes', label: 'Reportes', icon: FileBarChart },
        { href: '/analitica', label: 'Analítica', icon: ChartLine },
    ],
    alumno: [{ href: '/alumno', label: 'Mi asistencia', icon: UserCheck }],
    tecnico: [{ href: '/tecnico', label: 'Consola técnica', icon: Wrench }],
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
