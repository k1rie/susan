'use client';

import { useState } from 'react';
import CatalogoTabla from '../CatalogoTabla';
import CrearUsuarioDialog from '../CrearUsuarioDialog';
import { ROLES_USUARIO, etiquetaRol } from '../CrearUsuarioDialog/rolesUsuario.js';
import PasswordTemporalModal from '../PasswordTemporalModal';
import AccionesUsuario from './AccionesUsuario.jsx';
import { usuariosListar } from '@/lib/api/admin.js';

const COLUMNAS = [
    { key: 'correo', header: 'Correo', primary: true },
    { key: 'rol', header: 'Rol', render: (u) => etiquetaRol(u.rol) },
    {
        key: 'vinculo',
        header: 'Vínculo',
        render: (u) => (u.vinculo ? `${u.vinculo}${u.nombre ? ` - ${u.nombre}` : ''}` : <span className="text-muted-foreground">Sin vínculo</span>),
    },
    { key: 'activo', header: 'Estado', render: (u) => (u.activo ? 'Activa' : 'Inactiva') },
];

// Alta: la tabla genérica abre este "formulario", que en realidad es el diálogo de creación.
function FormularioCrear({ onClose, onGuardado, onCreado }) {
    return (
        <CrearUsuarioDialog
            open
            onClose={onClose}
            onCreado={(r) => {
                onCreado(r);
                onGuardado();
            }}
        />
    );
}

// RF-01 / RNF-08: cuentas de usuario. La contraseña temporal solo vive en este estado hasta que se cierra el modal.
export default function UsuariosPanel() {
    const [password, setPassword] = useState(null);
    const cerrar = () => setPassword(null);

    return (
        <>
            <CatalogoTabla
                titulo="Usuarios"
                subtitulo="Cuentas de acceso, roles y vínculos"
                listar={usuariosListar}
                columnas={COLUMNAS}
                rowKey="id_usuario"
                Formulario={FormularioCrear}
                formularioProps={{
                    onCreado: (r) => setPassword({ correo: r.correo, contrasena: r.contrasena_temporal, titulo: 'Cuenta creada' }),
                }}
                permitirEditar={false}
                nuevoLabel="Nueva cuenta"
                busquedaLabel="Correo o nombre"
                filtros={[{ name: 'rol', label: 'Rol', options: ROLES_USUARIO }]}
                unidad="cuenta(s)"
                vacioTitulo="No hay cuentas que coincidan"
                acciones={(fila, { refetch }) => <AccionesUsuario fila={fila} refetch={refetch} onPassword={setPassword} />}
            />
            <PasswordTemporalModal
                open={!!password}
                titulo={password?.titulo}
                correo={password?.correo}
                contrasena={password?.contrasena}
                onClose={cerrar}
            />
        </>
    );
}
