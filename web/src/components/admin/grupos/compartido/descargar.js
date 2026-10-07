// Descarga un texto como archivo desde el navegador (plantillas y reportes). Todo ocurre en el cliente: nada se sube a ningún servidor.
export function descargarTexto(nombre, texto, tipo = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Se libera después del clic: algunos navegadores leen el blob de forma asíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
