# Avatares - créditos y licencia

Los 24 SVG de esta carpeta (`avatar-NN-xx.svg`) se generaron con **DiceBear**, estilo **Lorelei**.

| Qué | Dato |
|---|---|
| Estilo | Lorelei (`@dicebear/collection` 9.4.2, motor `@dicebear/core` 9.4.3, MIT) |
| Autora del arte | Lisa Wischofsky ("Lorelei"; ficha del estilo en https://www.dicebear.com/styles/lorelei/) |
| Licencia del estilo | **CC0 1.0** (dominio público): uso comercial permitido, **sin obligación de atribuir** |
| Verificación | `meta.license.name` del paquete instalado en 2026-10-03: "CC0 1.0" (https://creativecommons.org/publicdomain/zero/1.0/) |
| Personajes | Ficticios. Los nombres de `manifest.json` son inventados y coinciden con los alumnos del video; no son personas reales |

La atribución no es obligatoria; se deja aquí por buena práctica.

## Estilos de DiceBear descartados por licencia

CC0 (aptos): lorelei, lorelei-neutral, notionists, notionists-neutral, open-peeps, glass, identicon, initials, pixel-art, rings, shapes, thumbs.
Requieren atribución (CC BY 4.0, NO usados): adventurer, big-ears, big-smile, croodles, dylan, fun-emoji, micah, miniavs, personas, toon-head.
Licencia propia "libre uso personal y comercial" (no es CC0, NO usada): avataaars, bottts.

## Regenerar

    mkdir -p /tmp/dice && cd /tmp/dice && npm init -y && npm i @dicebear/core @dicebear/collection
    node audit/iconos/gen-avatars.mjs /tmp/dice assets/avatars

Es determinista (mismas opciones, mismos SVG). Las dependencias NO se instalan en el proyecto.
