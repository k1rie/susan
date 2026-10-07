'use client';

import { ChevronRight, ScanFace } from 'lucide-react';
import TarjetaFila from '@/components/ui/TarjetaFila';
import { useApiQuery } from '@/hooks/data';
import { miRegistro } from '@/lib/api/biometria.js';

// Recordatorio en «Mi asistencia» mientras el registro facial esté incompleto. No molesta si ya está listo, si la cuenta no puede
// registrarse o si la consulta falla (es una ayuda, no un requisito: el portal funciona igual).
export default function AvisoRegistro() {
    const q = useApiQuery(miRegistro, {});
    const r = q.data;
    if (!r || r.completo || !r.puede_registrar) return null;
    const falta = r.paso === 'consentimiento' ? 'Acepta el aviso de privacidad y registra tu rostro' : 'Solo falta registrar tu rostro';
    return (
        <TarjetaFila
            href="/alumno/registro"
            icono={ScanFace}
            tono="dorado"
            titulo="Completa tu registro facial"
            subtitulo={`${falta} para que tu asistencia se tome con la cámara.`}
            lineas={3}
            accion={<ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} />}
        />
    );
}
