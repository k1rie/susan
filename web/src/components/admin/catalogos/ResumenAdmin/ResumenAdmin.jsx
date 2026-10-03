'use client';

import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import StatCard from '@/components/ui/StatCard';
import { useApiQuery } from '@/hooks/data';
import { adminResumen } from '@/lib/api/admin.js';

const ACCESOS = [
    { href: '/admin/grupos', label: 'Grupos' },
    { href: '/admin/alumnos', label: 'Alumnos' },
    { href: '/admin/docentes', label: 'Docentes' },
    { href: '/admin/materias', label: 'Materias' },
    { href: '/admin/aulas', label: 'Aulas' },
    { href: '/admin/usuarios', label: 'Usuarios' },
    { href: '/admin/bitacora', label: 'Bitácora' },
    { href: '/tecnico', label: 'Cámaras y sistema' },
];

// Portada del administrador: contadores de api_admin_resumen y accesos a los catálogos.
// `encabezado={false}`: la portada (HomeRol) aporta el h1 y las tarjetas de módulos reemplazan a los accesos rápidos.
export default function ResumenAdmin({ encabezado = true }) {
    const consulta = useApiQuery(adminResumen, {});

    return (
        <div className="flex flex-col gap-4">
            {encabezado && <PageHeader title="Administración" subtitle="Resumen del periodo y accesos rápidos" />}
            <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
                {(r) => {
                    const sesiones = r.sesiones_hoy ?? {};
                    const camaras = r.camaras ?? {};
                    return (
                        <section aria-label="Contadores" className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                                Periodo {r.periodo} · {r.fecha}
                            </p>
                            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
                                <StatCard animated label="Alumnos activos" value={r.alumnos_activos} href="/admin/alumnos" />
                                <StatCard animated label="Docentes activos" value={r.docentes_activos} href="/admin/docentes" />
                                <StatCard animated label="Grupos del periodo" value={r.grupos_periodo} href="/admin/grupos" />
                                <StatCard
                                    animated
                                    label="Sesiones de hoy"
                                    value={sesiones.total ?? 0}
                                    hint={`${sesiones.abiertas ?? 0} abiertas · ${sesiones.programadas ?? 0} programadas · ${sesiones.cerradas ?? 0} cerradas`}
                                />
                                <StatCard animated label="Cámaras activas" value={camaras.activas ?? 0} tone="success" href="/tecnico" />
                                <StatCard
                                    animated
                                    label="Cámaras inactivas"
                                    value={camaras.inactivas ?? 0}
                                    tone={(camaras.inactivas ?? 0) > 0 ? 'warning' : 'neutral'}
                                    hint="Incluye las en mantenimiento"
                                    href="/tecnico"
                                />
                                <StatCard
                                    animated
                                    label="Consentimientos por vencer (30 días)"
                                    value={r.consentimientos_por_vencer_30d ?? 0}
                                    tone={(r.consentimientos_por_vencer_30d ?? 0) > 0 ? 'warning' : 'neutral'}
                                    href="/admin/alumnos"
                                />
                                <StatCard
                                    animated
                                    label="Plantillas sin indexar"
                                    value={r.plantillas_sin_indexar ?? 0}
                                    tone={(r.plantillas_sin_indexar ?? 0) > 0 ? 'warning' : 'neutral'}
                                    href="/tecnico"
                                />
                            </div>
                        </section>
                    );
                }}
            </DataState>
            {encabezado && (
                <nav aria-label="Accesos" className="flex flex-wrap gap-2">
                    {ACCESOS.map((a) => (
                        <Button key={a.href} href={a.href} variant="secondary">
                            {a.label}
                        </Button>
                    ))}
                </nav>
            )}
        </div>
    );
}
