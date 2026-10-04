'use client';

import { CalendarClock, CheckCircle2, ChevronRight, GraduationCap, Presentation, ScanFace, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import AnilloEstados from '@/components/ui/AnilloEstados';
import Button from '@/components/ui/Button';
import DataState from '@/components/ui/DataState';
import StatCard from '@/components/ui/StatCard';
import TarjetaFila from '@/components/ui/TarjetaFila';
import TarjetaGrafica from '@/components/ui/TarjetaGrafica';
import { useApiQuery } from '@/hooks/data';
import { adminResumen } from '@/lib/api/admin.js';
import { resumenTexto } from '@/lib/graficas.js';
import { CONFIG_CAMARAS, CONFIG_SESIONES, avisosAtencion, datosCamaras, datosSesiones } from './resumenAdmin.utils.js';

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

const ICONOS = { CalendarClock, ScanFace };

// Portada del administrador: 3 contadores, dos gráficas (sesiones de hoy y cámaras) y avisos de atención de api_admin_resumen.
// `encabezado={false}`: la portada (HomeRol) aporta el h1 y las tarjetas de módulos reemplazan a los accesos rápidos.
export default function ResumenAdmin({ encabezado = true }) {
    const consulta = useApiQuery(adminResumen, {});

    return (
        <div className="flex flex-col gap-4">
            {encabezado && <PageHeader title="Administración" subtitle="Resumen del periodo y accesos rápidos" />}
            <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
                {(r) => {
                    const sesiones = datosSesiones(r.sesiones_hoy);
                    const camaras = datosCamaras(r.camaras);
                    const avisos = avisosAtencion(r);
                    return (
                        <>
                            <section aria-label="Contadores" className="flex flex-col gap-3">
                                <p className="text-sm text-muted-foreground">Periodo {r.periodo} · {r.fecha}</p>
                                {/* A 360 px dos tarjetas por fila y la tercera a todo el ancho (tres columnas dejarían ~60 px a cada etiqueta). */}
                                <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3">
                                    <StatCard animated icon={GraduationCap} label="Alumnos activos" value={r.alumnos_activos} href="/admin/alumnos" />
                                    <StatCard animated icon={Presentation} label="Docentes activos" value={r.docentes_activos} href="/admin/docentes" />
                                    <StatCard animated icon={Users} label="Grupos del periodo" value={r.grupos_periodo} href="/admin/grupos" className="col-span-2 min-[480px]:col-span-1" />
                                </div>
                            </section>
                            <section aria-label="Sesiones y cámaras" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                <TarjetaGrafica
                                    titulo="Sesiones de hoy"
                                    descripcion="Por estado"
                                    resumen={resumenTexto(sesiones, CONFIG_SESIONES)}
                                >
                                    <AnilloEstados datos={sesiones} config={CONFIG_SESIONES} centro={{ etiqueta: 'Sesiones' }} alto={260} vacio="Hoy no hay sesiones" />
                                </TarjetaGrafica>
                                <TarjetaGrafica
                                    titulo="Cámaras"
                                    descripcion="Inactivas incluye las en mantenimiento"
                                    acciones={<Button href="/tecnico" variant="ghost" size="sm" arrow>Ver cámaras</Button>}
                                    resumen={resumenTexto(camaras, CONFIG_CAMARAS)}
                                >
                                    <AnilloEstados datos={camaras} config={CONFIG_CAMARAS} centro={{ etiqueta: 'Cámaras' }} alto={260} vacio="No hay cámaras registradas" />
                                </TarjetaGrafica>
                            </section>
                            <section aria-labelledby="t-atencion" className="flex flex-col gap-3">
                                <h2 id="t-atencion" className="text-xl font-semibold tracking-tight">Para revisar</h2>
                                {avisos.length ? (
                                    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                        {avisos.map((a) => (
                                            <li key={a.clave}>
                                                <TarjetaFila
                                                    icono={ICONOS[a.icono]}
                                                    tono={a.tono}
                                                    titulo={a.titulo}
                                                    subtitulo={a.subtitulo}
                                                    href={a.href}
                                                    accion={<ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                                        <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-presente" strokeWidth={1.75} />
                                        Todo en orden: nada por vencer ni por indexar.
                                    </p>
                                )}
                            </section>
                        </>
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
