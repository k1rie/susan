'use client';

import { useState } from 'react';
import { docentesListar } from '@/lib/api/admin.js';
import CatalogoTabla from '../CatalogoTabla';
import CrearUsuarioDialog from '../CrearUsuarioDialog';
import { inicialDeDocente } from '../CrearUsuarioDialog/usuario.utils.js';
import { ESTATUS_DOCENTE, etiquetaEstatusDocente } from '../DocenteForm/docente.utils.js';
import DocenteForm from '../DocenteForm';
import PasswordTemporalModal from '../PasswordTemporalModal';

// En 360 px la tabla no cabe (y con el riel lateral abierto tampoco hasta ~1280 px: el correo solo desde `xl` y los grupos desde `lg`): el nombre lleva debajo el número y el estatus (solo en teléfono) y esas columnas se ocultan, así el
// botón «Editar» queda a la vista sin desplazar.
const COLUMNAS = [
    {
        key: 'nombre_completo',
        header: 'Nombre',
        primary: true,
        render: (d) => (
            <>
                {d.nombre_completo}
                <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                    {d.num_empleado} · {etiquetaEstatusDocente(d.estatus)}
                </span>
            </>
        ),
    },
    { key: 'num_empleado', header: 'No. empleado', hideBelow: 'sm' },
    { key: 'correo_institucional', header: 'Correo', className: 'hidden xl:table-cell' },
    { key: 'estatus', header: 'Estatus', hideBelow: 'sm', render: (d) => etiquetaEstatusDocente(d.estatus) },
    { key: 'grupos', header: 'Grupos', align: 'right', className: 'hidden lg:table-cell' },
];

// El siguiente paso de un alta de docente es su cuenta de acceso: el formulario avisa con `onCrearCuenta(docente)` y esta pantalla
// abre el panel de cuenta con el vínculo y el correo ya puestos, y luego muestra la contraseña temporal (una sola vez).
export default function ListadoDocentes() {
    const [cuentaPara, setCuentaPara] = useState(null);
    const [password, setPassword] = useState(null);

    return (
        <>
            <CatalogoTabla
                titulo="Docentes"
                subtitulo="Alta, edición y baja lógica"
                listar={docentesListar}
                columnas={COLUMNAS}
                rowKey="id_docente"
                Formulario={DocenteForm}
                formularioProps={{ onCrearCuenta: setCuentaPara }}
                nuevoLabel="Nuevo docente"
                busquedaLabel="Número de empleado o nombre"
                filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS_DOCENTE }]}
                unidad="docente(s)"
                vacioTitulo="No hay docentes que coincidan"
            />
            <CrearUsuarioDialog
                open={Boolean(cuentaPara)}
                inicial={cuentaPara ? inicialDeDocente(cuentaPara) : undefined}
                onClose={() => setCuentaPara(null)}
                onCreado={(r) => {
                    setCuentaPara(null);
                    setPassword({ correo: r.correo, contrasena: r.contrasena_temporal, titulo: 'Cuenta creada' });
                }}
            />
            <PasswordTemporalModal open={Boolean(password)} titulo={password?.titulo} correo={password?.correo} contrasena={password?.contrasena} onClose={() => setPassword(null)} />
        </>
    );
}
