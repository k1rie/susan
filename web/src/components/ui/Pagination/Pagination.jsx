import clsx from 'clsx';
import Button from '../Button/Button.jsx';
import Select from '../Select/Select.jsx';

// Paginación por desplazamiento (limit/offset) alineada con las RPC de listado.
export default function Pagination({ total, limit, offset, onChange, limits = [10, 25, 50], onLimitChange, className }) {
    if (!total) return null;
    const tam = Math.min(200, Math.max(1, limit || 1));
    const desde = Math.min(offset + 1, total);
    const hasta = Math.min(offset + tam, total);
    return (
        <div className={clsx('flex flex-wrap items-center justify-between gap-3 text-sm', className)}>
            <p aria-live="polite">
                Mostrando {desde}-{hasta} de {total}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                {onLimitChange && (
                    <Select
                        aria-label="Filas por página"
                        value={tam}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        options={limits.map((l) => ({ value: l, label: `${l} por página` }))}
                        className="!w-auto"
                    />
                )}
                <Button variant="secondary" disabled={offset <= 0} onClick={() => onChange({ offset: Math.max(0, offset - tam) })}>
                    Anterior
                </Button>
                <Button variant="secondary" disabled={offset + tam >= total} onClick={() => onChange({ offset: offset + tam })}>
                    Siguiente
                </Button>
            </div>
        </div>
    );
}
