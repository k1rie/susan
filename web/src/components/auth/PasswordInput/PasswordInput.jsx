'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input/Input.jsx';

// Input de contraseña con botón Mostrar/Ocultar. Oculta por defecto.
export default function PasswordInput({ id, name, value, onChange, autoComplete = 'current-password', required, invalid, disabled, ...rest }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="flex items-stretch gap-2">
            <Input
                id={id}
                name={name}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
                required={required}
                invalid={invalid}
                disabled={disabled}
                className="min-w-0 flex-1"
                {...rest}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-pressed={visible}
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="min-h-11 shrink-0 rounded-md border border-border bg-surface px-3 text-sm hover:bg-surface-muted"
            >
                {visible ? 'Ocultar' : 'Mostrar'}
            </button>
        </div>
    );
}
