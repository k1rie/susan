# Fuentes del video SUSAN v4

Todas son **SIL Open Font License 1.1** (OFL): se pueden incrustar, distribuir y usar en un video comercial sin costo;
no se venden solas y, si se modificaran, no podrían conservar el nombre reservado. El texto completo de la licencia está
en https://openfontlicense.org (y en `LICENSE` de cada paquete fuente). Verificado con `fontTools` el 2026-10-06
(tabla `name`, ejes `fvar`, cobertura de á é í ó ú ñ ¿ ¡ « » %).

| Archivo | Familia y cara | Variable | Uso en el video | Origen y derechos |
|---|---|---|---|---|
| `HankenGrotesk-var.woff2` | Hanken Grotesk, v3.013 | sí, `wght` 100–900 | **Toda la interfaz y los rótulos** (400/500/600). Declarar `font-weight:100 900` | © 2021 The Hanken Grotesk Project Authors (github.com/marcologous/hanken-grotesk). Copiado de la v3 |
| `HankenGrotesk-Regular.woff2` | idéntico byte a byte al anterior (md5 `a6b8…6263`) | sí | Alias heredado de la v3; preferir `-var` | Igual |
| `EBGaramond-var.woff2` | EB Garamond, v1.003, subconjunto latín | sí, `wght` 400–800 | **Serif de acento (500)**: saludo «Buenos días, Patricia» y, a lo sumo, un titular. Declarar `font-weight:400 800` | © 2017 The EB Garamond Project Authors (github.com/octaviopardo/EBGaramond12). Nuevo en la v4: npm `@fontsource-variable/eb-garamond@5.3.0`, archivo `files/eb-garamond-latin-wght-normal.woff2` |
| `EBGaramond-Italic-var.woff2` | EB Garamond Italic, subconjunto latín | sí, `wght` 400–800 | No previsto (la app no usa cursiva). Solo si se aprueba | Igual; `files/eb-garamond-latin-wght-italic.woff2` |
| `EBGaramond-Regular.woff2` | **EB Garamond Medium (500), estática** a pesar del nombre (usWeightClass 500) | no | Respaldo de la serif 500 si la variable fallara: declararla con `font-weight:500` | © 2017 The EB Garamond Project Authors. Copiado de la v3 |
| `EBGaramond-Italic.woff2`, `EBGaramond-Regular-Italic.woff2` | EB Garamond Medium Italic (500), idénticas entre sí | no | No previsto | Igual |
| `GeistMono-var.woff2` | Geist Mono, v1.701 | sí, `wght` 100–900 | Solo datos técnicos pequeños (casi nunca: la app del docente no la muestra) | © 2024 The Geist Project Authors (github.com/vercel/geist-font). Copiado de la v3 |
| `GeistMono-Regular.woff2` | idéntico a `GeistMono-var.woff2` | sí | Alias heredado | Igual |

## Bloque `@font-face` canónico (el mismo de `frame.md`)

Rutas relativas a la raíz del proyecto, dentro del `<template>` de cada cuadro (el render no tiene fuentes del sistema):

```css
@font-face{font-family:"Hanken Grotesk";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/HankenGrotesk-var.woff2") format("woff2");}
@font-face{font-family:"EB Garamond";font-weight:400 800;font-style:normal;font-display:block;src:url("assets/fonts/EBGaramond-var.woff2") format("woff2");}
@font-face{font-family:"Geist Mono";font-weight:100 900;font-style:normal;font-display:block;src:url("assets/fonts/GeistMono-var.woff2") format("woff2");}
```

## Notas

- La corrección respecto de `plan/DISENO-APP.md` §1.5: el `EBGaramond-Regular.woff2` heredado **no** es 400, es la Medium
  (500) estática; ahora además existe la variable 400–800. No usar la EB Garamond 700 que trae HyperFrames.
- El subconjunto latín de Fontsource cubre U+0000–00FF y la puntuación general (U+2000–206F): basta para el español.
- No se agregan Google Fonts por red: el render de esta máquina no los necesita y la carpeta es autosuficiente.
