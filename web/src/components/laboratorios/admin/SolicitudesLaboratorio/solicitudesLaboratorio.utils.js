export const PESTANAS = ['pendientes', 'agenda', 'historial'];

/** La pestaña pedida por un enlace (?pestana=...) o «pendientes» si no existe. */
export const normalizarPestana = (valor) => (PESTANAS.includes(valor) ? valor : 'pendientes');

/** Pestañas de la pantalla; el contador de «Pendientes» solo aparece cuando se conoce (no se inventa un 0 mientras carga). */
export function pestanasLaboratorios(pendientes) {
    return [
        { id: 'pendientes', label: 'Pendientes', count: pendientes ?? undefined },
        { id: 'agenda', label: 'Agenda' },
        { id: 'historial', label: 'Historial' },
    ];
}
