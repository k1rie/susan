'use client';

import { createContext, useContext } from 'react';

// Lo que el shell comparte con las páginas: quién es la persona y cómo abrir la paleta de comandos.
// Sin proveedor (pruebas, Storybook-lite) devuelve valores inertes en lugar de romper.
export const ShellContext = createContext({ me: null, abrirPaleta: () => {} });

export function useShell() {
    return useContext(ShellContext);
}
