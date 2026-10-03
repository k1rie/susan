import EmptyState from '../EmptyState/EmptyState.jsx';
import ErrorState from '../ErrorState/ErrorState.jsx';
import Spinner from '../Spinner/Spinner.jsx';
import { vacioPorDefecto } from './dataState.utils.js';

// Decide qué pintar según el resultado de una consulta (useApiQuery):
// error sin datos -> ErrorState; cargando sin datos -> fallback; vacío -> empty; si no, children(data).
// Si ya hay datos y se refresca, se conservan para evitar parpadeo.
export default function DataState({
    loading = false,
    error = null,
    data,
    onRetry,
    isEmpty = vacioPorDefecto,
    empty = <EmptyState title="Sin resultados" />,
    loadingFallback = (
        <div className="flex justify-center py-10">
            <Spinner />
        </div>
    ),
    children,
}) {
    const sinDatos = data == null;
    if (error && sinDatos) return <ErrorState error={error} onRetry={onRetry} />;
    if (loading && sinDatos) return loadingFallback;
    if (sinDatos) return empty;
    if (isEmpty(data)) return empty;
    return children(data);
}
