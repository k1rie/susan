#!/usr/bin/env bash
# build-capture-assets.sh — copia PLANA a capture/assets/ de las capturas reales elegidas para el video v4.
#
# Por qué existe: los scripts de la skill (stage-assets.mjs, assemble-index.mjs) solo buscan activos en
# capture/assets/ (sin subcarpetas); nunca leen capture/app-real/ (que además está fuera de git, ~170 MB).
# Este script es la receta reproducible: si se vuelve a correr scripts/capture-app.mjs, se regenera igual.
#
#   bash scripts/build-capture-assets.sh          # desde video/susan-v4
#
# Reglas: recortes a 2x tal cual (PNG); pantallas de 3840x2160 a 1920x1080 en JPEG q88 (pesan ~10 veces menos);
# móviles a 3x (390 css) recortados donde haga falta. Nombres kebab-case sin « - » ni «;» (los rompen los parsers).
# El inventario canónico con descripciones está en capture/extracted/asset-descriptions.md.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$RAIZ/capture/app-real"
DST="$RAIZ/capture/assets"
mkdir -p "$DST"

if [ ! -d "$SRC/crops" ]; then
    echo "No existe $SRC/crops: corre antes scripts/capture-app.mjs (ver capture/app-real/INVENTORY.md)." >&2
    exit 1
fi

copiar() {   # copiar <origen relativo a app-real> <destino>
    cp "$SRC/$1" "$DST/$2"
}
pantalla() { # pantalla <png 3840x2160> <destino .jpg>: reduce a la mitad (1920x1080) en JPEG de alta calidad
    convert "$SRC/$1" -resize 50% -strip -sampling-factor 4:2:0 -quality 88 "$DST/$2"
}
movil() {    # movil <png 1170x2532> <destino .jpg>: conserva 3x, JPEG
    convert "$SRC/$1" -strip -sampling-factor 4:2:0 -quality 88 "$DST/$2"
}
recorte() {  # recorte <png> <WxH+X+Y> <destino .png>
    convert "$SRC/$1" -crop "$2" +repage -strip "$DST/$3"
}

# ---------- pantallas completas (contexto, placas para rack focus, referencia de maquetación) ----------
pantalla desktop/10-docente-home.clean.png           pantalla-home-docente.jpg
pantalla desktop/21-analitica-3a.clean.png           pantalla-analitica-3a.jpg
pantalla desktop/25-revision-caso.clean.png          pantalla-revision-caso.jpg
pantalla desktop/19-reportes-grupo-3a.clean.png      pantalla-reportes-3a.jpg
pantalla desktop/39-escalonados-final.clean.png      pantalla-pasar-lista-maqueta.jpg
pantalla desktop/50-alumno-e260001-limite.clean.png  pantalla-alumno-limite.jpg
pantalla desktop/01-login.png                        pantalla-login-pasa-lista.jpg
pantalla desktop/91-bienvenida-paso2.png             pantalla-bienvenida-asi-funciona.jpg
movil    mobile/10-docente-home.clean.png            movil-home-docente.jpg
movil    mobile/21-analitica-3a.clean.png            movil-analitica-3a.jpg

# ---------- teléfono: barra inferior y botón central (fuente del sting de cierre) ----------
recorte mobile/10-docente-home.clean.png  1170x270+0+2232   movil-barra-inferior-panel.png
recorte mobile/21-analitica-3a.clean.png  1170x270+0+2232   movil-barra-inferior-analitica.png
recorte mobile/10-docente-home.clean.png  240x240+465+2238  movil-boton-central-pasar-lista.png

# ---------- panel del docente (/docente) ----------
recorte desktop/10-docente-home.full.png  940x470+1150+180  home-saludo-buenos-dias-patricia.png
copiar crops/10-docente-home--PasarListaHero.png         home-pasar-lista-hero.png
copiar crops/10-docente-home--TarjetaPortada-2.png       home-portada-pasar-lista-degradado.png
copiar crops/10-docente-home--TarjetaPortada-3.png       home-portada-revision-dorado.png
copiar crops/10-docente-home--TarjetaPortada-4.png       home-portada-reportes-verde.png
copiar crops/10-docente-home--TarjetaPortada-5.png       home-portada-analitica-violeta.png
copiar crops/10-docente-home--IndicadoresPendientes.png  home-indicadores-pendientes-8-4.png
copiar crops/10-docente-home--StatCard.png               home-statcard-pendientes-8.png
copiar crops/10-docente-home--Resaltado.png              home-resaltado-patricia.png
copiar crops/10-docente-home--BrandMark.png              home-brandmark-susan.png
copiar crops/10-docente-home--CampoComando.png           home-campo-comando.png
copiar crops/10-docente-home--TarjetaFila.png            home-fila-sesion-3a.png
copiar crops/10-docente-home--MisGrupos.png              home-mis-grupos.png
copiar crops/10-docente-home--GraficaAlertas.png         home-faltas-vs-limite.png
copiar crops/10-docente-home--StatusChip.png             chip-programada.png

# ---------- pasar lista en vivo (componentes reales; cifras de la cámara simulada, NO canónicas) ----------
copiar crops/30-pasar-lista-inicio--PageHeader.png       sesion-encabezado-abierta-automatico.png
copiar crops/30-pasar-lista-inicio--GuiaPasarLista.png   sesion-guia-asi-se-pasa-lista.png
copiar crops/30-pasar-lista-inicio--VistaCamara.png      sesion-camara-en-pausa.png
copiar crops/30-pasar-lista-inicio--ResumenPaseLista.png sesion-resumen-0-de-24.png
copiar crops/39-escalonados-final--ResumenPaseLista.png  sesion-resumen-16-de-24.png
copiar crops/33-pasar-lista-presentes--MedidorLiquido.png sesion-medidor-liquido.png
copiar crops/30-pasar-lista-inicio--AnilloEstados.png    sesion-anillo-sin-registro.png
copiar crops/39-escalonados-final--AnilloEstados.png     sesion-anillo-presentes-retardos.png
copiar crops/33-pasar-lista-presentes--GraficaAsistenciaSesion.png sesion-grafica-asistencia.png
copiar crops/33-pasar-lista-presentes--VentanaTolerancia.png sesion-ventana-tolerancia.png
copiar crops/33-pasar-lista-presentes--AccionesPaseLista.png sesion-acciones-cerrar-registrar.png
copiar crops/30-pasar-lista-inicio--StatCard-3.png       sesion-statcard-retardos.png
recorte crops/39-escalonados-final--TablaAlumnosSesion.png 1984x900+0+0 sesion-tabla-alumnos-maqueta.png

# ---------- revisión ----------
copiar crops/25-revision-caso--Tabs.png                  revision-pestanas-pendientes-8.png
copiar crops/25-revision-caso--CasoPendiente.png         revision-caso-emilio.png
copiar crops/25-revision-caso--TarjetaGrafica.png        revision-score-por-lectura.png
copiar crops/25-revision-caso--ResolverComo.png          revision-resolver-como.png
copiar crops/25-revision-caso--StatusChip.png            chip-pendiente.png

# ---------- analítica 3A ----------
copiar crops/21-analitica-3a--TarjetasAnalitica.png      analitica-fila-cifras.png
copiar crops/21-analitica-3a--StatCard.png               analitica-statcard-ausentismo-20-8.png
copiar crops/21-analitica-3a--StatCard-2.png             analitica-statcard-proyeccion-24-8.png
copiar crops/21-analitica-3a--StatCard-4.png             analitica-statcard-riesgo-9.png
copiar crops/21-analitica-3a--GraficaSerie.png           analitica-tarjeta-ausentismo-semanal.png
copiar crops/21-analitica-3a--GraficaLinea.png           analitica-grafica-linea-semanal.png
copiar crops/21-analitica-3a--GraficaAcumulado.png       analitica-faltas-acumuladas-limite.png
copiar crops/21-analitica-3a--PatronSemanal.png          analitica-patron-semanal-viernes.png
copiar crops/21-analitica-3a--TiraSemana.png             analitica-tira-semana.png
copiar crops/21-analitica-3a--BarrasPildora.png          analitica-ranking-riesgo.png
copiar crops/21-analitica-3a--AnilloEstados.png          analitica-anillo-riesgo-9.png
copiar crops/21-analitica-3a--TablaRiesgo.png            analitica-alumnos-en-riesgo.png

# ---------- reportes 3A ----------
copiar crops/19-reportes-grupo-3a--BarrasPildora.png     reportes-faltas-por-alumno-limite.png
copiar crops/19-reportes-grupo-3a--AnilloEstados.png     reportes-anillo-estados-81.png
copiar crops/19-reportes-grupo-3a--IndicadoresGrupo.png  reportes-indicadores-grupo.png
copiar crops/19-reportes-grupo-3a--BotonesExportar.png   reportes-exportar-csv.png
copiar crops/19-reportes-grupo-3a--ImpactoTiempo.png     reportes-impacto-95-min.png

# ---------- alumno (E260001, en el límite: referencia de maquetación para reconstruir a Iván) ----------
copiar crops/50-alumno-e260001-limite--MedidorLiquido.png alumno-medidor-asistencia.png
copiar crops/50-alumno-e260001-limite--BarraFaltas.png   alumno-barra-faltas-limite.png
copiar crops/50-alumno-e260001-limite--Alert.png         alumno-aviso-en-el-limite.png

# ---------- acceso ----------
copiar crops/01-login--PanelProducto.png                 login-panel-producto.png

n=$(find "$DST" -maxdepth 1 -type f | wc -l)
echo "capture/assets: $n archivos, $(du -sh "$DST" | cut -f1)"
