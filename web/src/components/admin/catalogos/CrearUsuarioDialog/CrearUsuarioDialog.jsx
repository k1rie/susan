'use client';

import { useRef, useState } from 'react';
import Field from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import { LIMITES } from '@/lib/formularios';
import { crearUsuario } from '@/lib/http/admin.js';
import PanelCatalogo from '../PanelCatalogo';
import { useAltaCatalogo } from '../PanelCatalogo/useAltaCatalogo.js';
import SelectorRol from '../SelectorRol';
import { etiquetaRol, requiereVinculo } from './rolesUsuario.js';
import { argumentosCrearUsuario, errorDeCampoUsuario, normalizarCorreoUsuario, validarUsuario } from './usuario.utils.js';
import VinculoSelect from './VinculoSelect.jsx';

/**
 * Crea la cuenta (RF-01) en un panel lateral: rol -> vínculo -> correo. El correo se prellena con el institucional del docente o
 * alumno elegido (editable), y el servidor genera la contraseña temporal: llega a `onCreado(respuesta)` para que el padre la muestre UNA
 * sola vez (PasswordTemporalModal); aquí no se guarda. La contraseña NO se captura (el contrato de la ruta no la acepta), así que no
 * hay campo de contraseña: el panel lo dice con una línea.
 *   inicial   { rol?, vinculo?: { value, label, description?, correo? } } para abrir con el vínculo y el correo ya puestos
 *             (p. ej. desde «Crear cuenta de acceso» tras dar de alta a un docente).
 */
export default function CrearUsuarioDialog({ open, onClose, onCreado, inicial }) {
    if (!open) return null;
    return <Formulario onClose={onClose} onCreado={onCreado} inicial={inicial} />;
}

function Formulario({ onClose, onCreado, inicial }) {
    const vinculoInicial = inicial?.vinculo ?? null;
    // Opción elegida (con su correo): no es un campo del formulario, solo la etiqueta del Combobox y la fuente del correo sugerido.
    const [opcionVinculo, setOpcionVinculo] = useState(vinculoInicial);
    // Correo sugerido por el vínculo y si la persona lo escribió a mano (si sí, elegir otro vínculo ya no lo pisa).
    const [sugerido, setSugerido] = useState(vinculoInicial?.correo ? { correo: vinculoInicial.correo, de: vinculoInicial.label } : null);
    const correoManual = useRef(false);

    const valoresIniciales = { rol: inicial?.rol ?? 'docente', vinculo: vinculoInicial?.value ?? '', correo: vinculoInicial?.correo ?? '' };
    const { f, campo, formId, enviar } = useAltaCatalogo({
        editando: false,
        inicial: valoresIniciales,
        validar: validarUsuario,
        mapearError: errorDeCampoUsuario,
        guardar: (v) => crearUsuario(argumentosCrearUsuario(v)),
        onCreado,
        onClose,
    });

    const rol = f.valores.rol;
    const correo = campo('correo');
    const vinculo = campo('vinculo');
    const correoEsSugerido = Boolean(sugerido) && f.valores.correo === sugerido.correo;

    const quitarSugerido = () => {
        if (correoEsSugerido && !correoManual.current) f.setCampo('correo', '');
        setSugerido(null);
    };

    const cambiarRol = (nuevo) => {
        if (nuevo === rol) return;
        f.setCampo('rol', nuevo);
        f.setCampo('vinculo', '');
        setOpcionVinculo(null);
        quitarSugerido();
    };

    const cambiarVinculo = (valor, opcion) => {
        f.setCampo('vinculo', valor);
        setOpcionVinculo(opcion);
        if (opcion?.correo) {
            // El correo institucional del docente o alumno es el candidato natural: se pone solo si la persona no escribió uno.
            if (!correoManual.current) f.setCampo('correo', opcion.correo);
            setSugerido({ correo: opcion.correo, de: opcion.label });
        } else {
            quitarSugerido();
        }
    };

    return (
        <PanelCatalogo
            f={f}
            formId={formId}
            onEnviar={enviar}
            onClose={onClose}
            title="Nueva cuenta de usuario"
            description="Se genera una contraseña temporal que verás una sola vez al terminar."
            etiquetaCrear="Crear cuenta"
            tituloError="No se pudo crear la cuenta"
        >
            {/* Si ya viene con vínculo (desde «Crear cuenta de acceso» tras un alta) el rol está decidido: se pliega para que el teléfono
                muestre de entrada el vínculo y el correo en vez de cuatro tarjetas. */}
            <FormSection title="Rol de la cuenta" collapsible defaultOpen={!vinculoInicial} summary={etiquetaRol(rol)}>
                <Field as="fieldset" label="Rol" required reserveError>
                    <SelectorRol label="Rol de la cuenta" name="rol" value={rol} onChange={cambiarRol} />
                </Field>
            </FormSection>
            <FormSection title="Datos de la cuenta">
                {requiereVinculo(rol) && (
                    <VinculoSelect rol={rol} value={f.valores.vinculo} selected={opcionVinculo ?? undefined} onChange={cambiarVinculo} error={vinculo.error} />
                )}
                <Field
                    label="Correo de acceso"
                    required
                    error={correo.error}
                    hint={correoEsSugerido ? `Tomado del correo institucional de ${sugerido.de}. Puedes cambiarlo.` : 'Con este correo iniciará sesión.'}
                    reserveError
                >
                    <Input
                        {...correo.props}
                        type="email"
                        inputMode="email"
                        maxLength={LIMITES.correo}
                        transform={normalizarCorreoUsuario}
                        autoComplete="off"
                        onChange={(e) => {
                            if (e.target.value !== sugerido?.correo) correoManual.current = true;
                            correo.props.onChange(e);
                        }}
                    />
                </Field>
            </FormSection>
        </PanelCatalogo>
    );
}
