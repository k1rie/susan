// Saludo según la hora local (0-23). El servidor no conoce la zona horaria de la persona: HomeRol usa "Hola" en el
// HTML inicial y cambia al saludo por hora al hidratar (sin desajuste de hidratación).
export function saludoPorHora(hora) {
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
}

// Primer nombre de api_yo().nombre ("Patricia Ortega Salinas" -> "Patricia"). Para cuentas sin persona (administración,
// técnico) el nombre puede ser el correo: en ese caso no se usa.
export function primerNombre(nombre) {
    const limpio = String(nombre ?? '').trim();
    if (!limpio || limpio.includes('@')) return null;
    return limpio.split(/\s+/)[0];
}
