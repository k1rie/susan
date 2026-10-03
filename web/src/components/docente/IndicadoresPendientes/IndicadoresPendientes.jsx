import StatCard from '@/components/ui/StatCard';

// Contadores del panel: registros pendientes de revisar y justificantes por resolver (enlazan a P-05).
export default function IndicadoresPendientes({ pendientes = 0, justificantes = 0 }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard label="Registros pendientes de revisión" value={pendientes} tone={pendientes > 0 ? 'warning' : 'neutral'} href="/docente/revision?pestana=pendientes" />
            <StatCard label="Justificantes por resolver" value={justificantes} tone={justificantes > 0 ? 'warning' : 'neutral'} href="/docente/revision?pestana=justificantes" />
        </div>
    );
}
