'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { confirmarNavegacion } from '@/hooks/ui/useCambiosSinGuardar.js';
import CamarasEstado from '../CamarasEstado';
import ParametrosEditor from '../ParametrosEditor';
import IndiceFacialPanel from '../IndiceFacialPanel';

const PESTANAS = [
    { id: 'camaras', label: 'Cámaras' },
    { id: 'parametros', label: 'Parámetros' },
    { id: 'indice', label: 'Índice facial' },
];

// Consola del técnico: cámaras (RF-22), parámetros (RNF-02) e índice facial (RNF-09/RNF-14). `soloLectura` (administrador):
// sin botones de guardar ni de reconstruir; la base lo aplica de todos modos.
export default function ConsolaTecnico({ encabezado = true, soloLectura = false }) {
    const [activa, setActiva] = useState('camaras');
    return (
        <div>
            {encabezado && <PageHeader title="Consola técnica" subtitle="Cámaras, parámetros del sistema e índice facial." />}
            {/* Cada pestaña desmonta a la anterior: sin la pregunta se perderían los parámetros sin guardar. */}
            <Tabs tabs={PESTANAS} value={activa} onChange={setActiva} idPrefix="tec" confirmLeave={() => confirmarNavegacion()} />
            <div role="tabpanel" id={`tec-panel-${activa}`} aria-labelledby={`tec-${activa}`} className="mt-4">
                {activa === 'camaras' && <CamarasEstado soloLectura={soloLectura} />}
                {activa === 'parametros' && <ParametrosEditor soloLectura={soloLectura} />}
                {activa === 'indice' && <IndiceFacialPanel soloLectura={soloLectura} />}
            </div>
        </div>
    );
}
