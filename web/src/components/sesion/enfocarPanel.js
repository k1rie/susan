// Llegar con ?pasar-lista=1: el panel principal (cámara o pase manual) recibe el foco, para que los lectores de pantalla y el teclado
// aterricen en él, y solo se desplaza hasta verlo si no se ve (`nearest`: sin saltos cuando ya está a la vista). Con «reducir movimiento»
// el desplazamiento es inmediato. Se llama desde un efecto (usa window), con el elemento del panel (tabIndex -1).
export function enfocarPanel(elemento) {
    if (!elemento) return;
    elemento.focus({ preventScroll: true });
    const reducido = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elemento.scrollIntoView?.({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
}
