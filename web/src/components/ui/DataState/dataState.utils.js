// Criterio de vacío por defecto: arreglo sin elementos o { items: [] }.
export function vacioPorDefecto(data) {
    if (Array.isArray(data)) return data.length === 0;
    if (Array.isArray(data?.items)) return data.items.length === 0;
    return false;
}
