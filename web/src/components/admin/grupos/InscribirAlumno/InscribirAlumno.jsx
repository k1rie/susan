'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { alumnosListar, inscribir } from '@/lib/api/admin.js';

// Búsqueda de alumnos activos por matrícula o nombre e inscripción en el grupo.
// `inscritosActivos` (ids) evita ofrecer a quien ya está inscrito; el servidor rechaza duplicados de todos modos.
export default function InscribirAlumno({ idGrupo, inscritosActivos = [], onInscrito }) {
    const { toast } = useToast();
    const [borrador, setBorrador] = useState('');
    const [q, setQ] = useState('');
    const resultados = useApiQuery(alumnosListar, { q, estatus: 'activo', limit: 10 }, { enabled: q.length >= 2 });
    const inscribirAlumno = useApiMutation(inscribir);
    const [enCurso, setEnCurso] = useState(null);

    const buscar = (e) => {
        e.preventDefault();
        setQ(borrador.trim());
    };

    const inscribirA = async (a) => {
        setEnCurso(a.id_alumno);
        try {
            const r = await inscribirAlumno.run({ idGrupo, idAlumno: a.id_alumno });
            toast({ tone: 'success', message: `${a.nombre_completo} ${r.reinscrita ? 'reinscrito' : 'inscrito'}.` });
            onInscrito?.(r);
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo inscribir', message: error.message });
        } finally {
            setEnCurso(null);
        }
    };

    const items = resultados.data?.items ?? [];

    return (
        <div className="grid gap-3">
            <form onSubmit={buscar} role="search" aria-label="Buscar alumno para inscribir" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Matrícula o nombre" hint="Mínimo 2 caracteres">
                    <Input type="search" value={borrador} onChange={(e) => setBorrador(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={borrador.trim().length < 2}>
                    Buscar
                </Button>
            </form>
            <div aria-live="polite">
                {q.length >= 2 && resultados.loading && <p className="text-sm text-muted">Buscando...</p>}
                {resultados.error && <p className="text-sm text-danger">{resultados.error.message}</p>}
                {q.length >= 2 && !resultados.loading && !resultados.error && items.length === 0 && (
                    <p className="text-sm text-muted">Sin alumnos activos que coincidan.</p>
                )}
            </div>
            {items.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                    {items.map((a) => {
                        const ya = inscritosActivos.includes(a.id_alumno);
                        return (
                            <li key={a.id_alumno} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <span className="text-sm">
                                    <span className="font-medium">{a.matricula}</span> {a.nombre_completo}
                                </span>
                                {ya ? (
                                    <span className="text-sm text-muted">Ya inscrito</span>
                                ) : (
                                    <Button size="sm" loading={enCurso === a.id_alumno} onClick={() => inscribirA(a)}>
                                        Inscribir
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
