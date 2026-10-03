#!/usr/bin/env bash
# Resuelve SUSAN_LOCAL_DIR: donde viven los datos MUTABLES del modo local (clúster PostgreSQL, storage, PIDs, logs).
# Si el proyecto esta en una carpeta que iCloud sincroniza (Escritorio, Documentos, iCloud Drive), iCloud desaloja
# archivos ("dataless"), duplica directorios vivos ("X 2") y corrompe un clúster PostgreSQL en uso; por eso en ese caso
# los datos van a ~/.susan-local/<proyecto>, fuera de cualquier carpeta sincronizada. En otro caso: <repo>/.local.
# Se puede forzar con SUSAN_LOCAL_DIR=/ruta antes de invocar cualquier script.
_susan_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd -P)"
if [ -z "${SUSAN_LOCAL_DIR:-}" ]; then
    # Si ya existe un estado local previo en ~/.susan-local/<proyecto> (p. ej. el proyecto se movio fuera del Escritorio
    # despues de crearlo), se sigue usando para no abandonar el clúster y los archivos existentes.
    if [ -d "$HOME/.susan-local/$(basename "$_susan_root")" ]; then
        SUSAN_LOCAL_DIR="$HOME/.susan-local/$(basename "$_susan_root")"
    else
    case "$_susan_root" in
        "$HOME/Desktop"/*|"$HOME/Documents"/*|*"/Library/Mobile Documents/"*)
            SUSAN_LOCAL_DIR="$HOME/.susan-local/$(basename "$_susan_root")" ;;
        *)
            SUSAN_LOCAL_DIR="$_susan_root/.local" ;;
    esac
    fi
fi
export SUSAN_LOCAL_DIR
mkdir -p "$SUSAN_LOCAL_DIR"
