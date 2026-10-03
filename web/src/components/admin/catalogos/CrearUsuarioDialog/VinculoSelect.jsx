'use client';

import { useState } from 'react';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useApiQuery } from '@/hooks/data';
import { alumnosListar, docentesListar } from '@/lib/api/admin.js';

// Elige el docente o alumno al que se vincula una cuenta (solo para roles docente/alumno).
export default function VinculoSelect({ rol, value, onChange, error }) {
    const [q, setQ] = useState('');
    const esDocente = rol === 'docente';
    const docentes = useApiQuery(docentesListar, { estatus: 'activo', limit: 200 }, { enabled: esDocente });
    const buscarAlumno = q.trim().length >= 2;
    const alumnos = useApiQuery(alumnosListar, { q: q.trim(), estatus: 'activo', limit: 20 }, { enabled: rol === 'alumno' && buscarAlumno });

    if (rol !== 'docente' && rol !== 'alumno') return null;

    if (esDocente) {
        const opciones = (docentes.data?.items ?? []).map((d) => ({
            value: String(d.id_docente),
            label: `${d.num_empleado} - ${d.nombre_completo}`,
        }));
        return (
            <Field label="Docente vinculado" required error={error || docentes.error?.message}>
                <Select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    options={[{ value: '', label: docentes.loading ? 'Cargando...' : 'Seleccione un docente' }, ...opciones]}
                />
            </Field>
        );
    }

    const opciones = (alumnos.data?.items ?? []).map((a) => ({
        value: String(a.id_alumno),
        label: `${a.matricula} - ${a.nombre_completo}`,
    }));
    return (
        <div className="flex flex-col gap-3">
            <Field label="Buscar alumno (matrícula o nombre)" hint="Escriba al menos 2 caracteres.">
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Alumno vinculado" required error={error || alumnos.error?.message}>
                <Select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    options={[
                        { value: '', label: !buscarAlumno ? 'Busque un alumno' : alumnos.loading ? 'Cargando...' : opciones.length ? 'Seleccione un alumno' : 'Sin resultados' },
                        ...opciones,
                    ]}
                />
            </Field>
        </div>
    );
}
