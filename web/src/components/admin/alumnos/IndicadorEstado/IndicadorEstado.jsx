import Badge from '@/components/ui/Badge';

// Indicador con texto y color (nunca solo color): ok -> verde, falso -> gris/ámbar según `tone`.
export default function IndicadorEstado({ ok, textoOk, textoNo, toneNo = 'neutral' }) {
    return <Badge tone={ok ? 'success' : toneNo}>{ok ? textoOk : textoNo}</Badge>;
}
