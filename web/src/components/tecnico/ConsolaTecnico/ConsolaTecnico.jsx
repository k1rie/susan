'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import CamarasEstado from '../CamarasEstado';
import ParametrosEditor from '../ParametrosEditor';
import IndiceFacialPanel from '../IndiceFacialPanel';

const PESTANAS = [
    { id: 'camaras', label: 'Cámaras' },
    { id: 'parametros', label: 'Parámetros' },
    { id: 'indice', label: 'Índice facial' },
];

// Consola del técnico: cámaras (RF-22), parámetros (RNF-02) e índice facial (RNF-09/RNF-14).
export default function ConsolaTecnico({ encabezado = true }) {
    const [activa, setActiva] = useState('camaras');
    return (
        <div>
            {encabezado && <PageHeader title="Consola técnica" subtitle="Cámaras, parámetros del sistema e índice facial." />}
            <Tabs tabs={PESTANAS} value={activa} onChange={setActiva} idPrefix="tec" />
            <div role="tabpanel" id={`tec-panel-${activa}`} aria-labelledby={`tec-${activa}`} className="mt-4">
                {activa === 'camaras' && <CamarasEstado />}
                {activa === 'parametros' && <ParametrosEditor />}
                {activa === 'indice' && <IndiceFacialPanel />}
            </div>
        </div>
    );
}
