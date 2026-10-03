import Card from '@/components/ui/Card';

// Tarjeta de impacto: minutos de pase de lista recuperados. SIEMPRE se declara como estimación.
export default function ImpactoTiempo({ impacto }) {
    const i = impacto || {};
    return (
        <Card title="Impacto en tiempo de clase">
            <p className="text-3xl font-semibold">{i.minutos_recuperados ?? 0} min</p>
            <p className="text-sm text-muted">
                recuperados (aprox. {Number(i.horas_recuperadas ?? 0).toFixed(1)} h) · {i.sesiones_automaticas ?? 0} sesiones automáticas,{' '}
                {i.sesiones_manuales ?? 0} manuales de {i.sesiones_cerradas ?? 0} cerradas
            </p>
            <p className="mt-2 text-xs text-muted">
                Estimación, no una medición: sesiones automáticas × {i.minutos_pase_lista_base ?? 5} min de pase de lista manual.
            </p>
        </Card>
    );
}
