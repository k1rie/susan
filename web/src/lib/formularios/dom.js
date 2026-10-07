// Escribe un valor en un <input>/<textarea> NATIVO y avisa a React como si la persona lo hubiera tecleado: el `onChange` del
// consumidor recibe un evento real con `e.target.value` (y `e.target.name`), igual que con cualquier Input. Así las acciones
// de un campo (atajos de fecha, "Generar" contraseña, transformar al salir) no obligan a cambiar la firma de `onChange`.
//
// React sigue el valor de los inputs controlados con su propio rastreador; asignar `input.value = x` no dispara nada, por eso
// se llama al setter del prototipo (que salta el rastreador) y se emite un evento `input` que burbujea.
export function emitirCambio(elemento, valor) {
    if (!elemento || typeof elemento.dispatchEvent !== 'function') return false;
    const prototipo = Object.getPrototypeOf(elemento);
    const asignar = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;
    if (!asignar) return false;
    asignar.call(elemento, valor);
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}
