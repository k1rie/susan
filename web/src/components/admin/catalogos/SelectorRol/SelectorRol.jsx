'use client';

import TarjetaOpcion from '@/components/ui/TarjetaOpcion';
import { ROLES_USUARIO } from '../CrearUsuarioDialog/rolesUsuario.js';

/**
 * Elige el rol de una cuenta con tarjetas que explican qué puede hacer cada uno. Va dentro de un `Field as="fieldset"`.
 * Una columna: en un panel de ~29 rem dos tarjetas con icono, texto y marca quedarían demasiado estrechas.
 *   actual   rol que ya tiene la cuenta (al cambiarlo): se rotula «(rol actual)».
 */
export default function SelectorRol({ value, onChange, actual, ...rest }) {
    const opciones = ROLES_USUARIO.map((r) => ({
        value: r.value,
        titulo: actual === r.value ? `${r.label} (rol actual)` : r.label,
        descripcion: r.descripcion,
        icono: r.icono,
    }));
    return <TarjetaOpcion opciones={opciones} value={value} onChange={onChange} columnas={1} {...rest} />;
}
