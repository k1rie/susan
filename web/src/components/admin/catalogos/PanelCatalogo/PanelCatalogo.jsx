'use client';

import { useEffect, useRef } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import PanelLateral from '@/components/ui/PanelLateral';
import SuccessState from '@/components/ui/SuccessState';
import { mensajeDeError } from '../comun.js';

/**
 * Panel lateral de un solo paso para el alta o la edición de un catálogo (aula, materia, docente). Pone el pie fijo con
 * «Cambios sin guardar», el motivo por el que no se puede guardar, «Guardar y crear otro» y, tras crear, la pantalla de éxito con el
 * siguiente paso. Lo que cambia entre catálogos (campos, textos, qué sigue) entra por props; el estado, por `useAltaCatalogo`.
 *
 *   f, formId, onEnviar   de `useAltaCatalogo` (`onEnviar` = su `enviar`).
 *   title, description    cabecera del panel.
 *   editando              true: «Guardar cambios», apagado mientras no haya cambios (y dice por qué). false: el botón NO se apaga por
 *                         datos inválidos (el clic muestra los errores y enfoca el primero: flujos P10).
 *   etiquetaCrear         verbo + objeto («Crear aula»).   etiquetaOtra: «Crear y agregar otra»; sin `onOtra` no aparece.
 *   exito                 props de SuccessState (title, description, steps, actions) o null; si existe sustituye al formulario.
 *   tituloError           título del aviso cuando el servidor rechaza el envío sin apuntar a un campo.
 */
export default function PanelCatalogo({
    f,
    formId,
    onEnviar,
    onClose,
    onOtra,
    title,
    description,
    editando = false,
    etiquetaCrear = 'Crear',
    etiquetaGuardar = 'Guardar cambios',
    etiquetaOtra = 'Crear y agregar otra',
    exito = null,
    tituloError = 'No se pudo guardar',
    size = 'md',
    children,
}) {
    const avisoRef = useRef(null);
    // El aviso general va arriba del formulario: si la persona había bajado en el panel, se le trae a la vista.
    useEffect(() => {
        if (f.errorEnvio) avisoRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [f.errorEnvio]);

    // El pie también dice por qué no se guardó (campos R05): quien llega a los botones sabe que faltan datos sin subir a buscarlos.
    // Corto a propósito: el detalle de cada error ya está junto a su campo, y el pie de un panel es estrecho.
    const hayErrores = Object.keys(f.errores).length > 0;
    const motivoBloqueo = editando && !f.sucio ? 'Aún no hay cambios que guardar.' : hayErrores ? 'Revisa los campos marcados.' : undefined;
    const hayEstado = Boolean(motivoBloqueo) || (editando ? f.cambios > 0 : f.sucio);

    return (
        <PanelLateral
            open
            onClose={onClose}
            title={title}
            description={exito ? undefined : description}
            size={size}
            dirty={f.sucio}
            closeDisabled={f.enviando}
            footer={
                exito
                    ? undefined
                    : ({ cerrar }) => (
                          // Dos filas: el estado («Cambios sin guardar», motivo) arriba y los botones abajo. Así el estado puede crecer hacia
                          // arriba sin mover los botones (en un pie de 32 rem, junto a tres botones, el texto quedaba en una columna de 80 px
                          // y al aparecer el motivo todo el pie saltaba).
                          <div className="flex w-full flex-col">
                              <FormActions flat dirty={editando ? f.cambios : f.sucio} motivoBloqueo={motivoBloqueo} className={hayEstado ? 'pb-2' : undefined} />
                              <FormActions flat>
                                  <Button variant="secondary" onClick={cerrar} disabled={f.enviando}>
                                      Cancelar
                                  </Button>
                                  {!editando && onOtra && (
                                      <Button variant="secondary" onClick={onOtra} disabled={f.enviando}>
                                          {etiquetaOtra}
                                      </Button>
                                  )}
                                  <Button type="submit" form={formId} loading={f.enviando} disabled={editando && !f.sucio}>
                                      {editando ? etiquetaGuardar : etiquetaCrear}
                                  </Button>
                              </FormActions>
                          </div>
                      )
            }
        >
            {exito ? (
                <SuccessState {...exito} />
            ) : (
                <form id={formId} onSubmit={onEnviar} noValidate className="flex flex-col gap-6 pb-2">
                    {f.errorEnvio && (
                        <div ref={avisoRef}>
                            <Alert tone="danger" compact title={tituloError}>
                                {mensajeDeError(f.errorEnvio)}
                            </Alert>
                        </div>
                    )}
                    {children}
                </form>
            )}
        </PanelLateral>
    );
}
