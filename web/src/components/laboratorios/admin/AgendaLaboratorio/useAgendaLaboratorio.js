'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/data';
import { laboratorioAgenda } from '@/lib/api/laboratorios.js';
import { lunesDeSemana, sumarDias } from '../../laboratorios.utils.js';
import { agruparPorDia, esSemanaActual, rangoSemana, resumenSemana } from './agendaLaboratorio.utils.js';

// Estado de la agenda: laboratorio elegido, semana (lunes a domingo) y la consulta de ocupación de esa semana.
//   laboratorios   resultado de useApiQuery(laboratoriosListar).
//   hoy            'AAAA-MM-DD' del plantel (null mientras se sabe): decide la semana inicial y el botón «Hoy».
export function useAgendaLaboratorio({ laboratorios, hoy }) {
    const items = laboratorios?.data?.items ?? [];
    const [elegido, setElegido] = useState(null);
    const [lunesElegido, setLunesElegido] = useState(null);

    // Si el laboratorio elegido ya no existe (dejó de ser laboratorio) o aún no se elige, se muestra el primero.
    const idAula = items.some((l) => l.id_aula === elegido) ? elegido : (items[0]?.id_aula ?? null);
    const lunes = lunesElegido ?? (hoy ? lunesDeSemana(hoy) : null);
    const rango = lunes ? rangoSemana(lunes) : null;

    const consulta = useApiQuery(
        laboratorioAgenda,
        { idAula, desde: rango?.desde, hasta: rango?.hasta },
        { enabled: idAula != null && rango != null },
    );

    const bloques = consulta.data?.bloques ?? null;
    return {
        idAula,
        elegirLaboratorio: (valor) => setElegido(Number(valor)),
        lunes,
        irAnterior: () => lunes && setLunesElegido(sumarDias(lunes, -7)),
        irSiguiente: () => lunes && setLunesElegido(sumarDias(lunes, 7)),
        irHoy: () => setLunesElegido(null),
        esSemanaActual: esSemanaActual(lunes, hoy),
        consulta,
        dias: lunes ? agruparPorDia(bloques, lunes) : [],
        resumen: bloques ? resumenSemana(bloques) : null,
    };
}

export default useAgendaLaboratorio;
