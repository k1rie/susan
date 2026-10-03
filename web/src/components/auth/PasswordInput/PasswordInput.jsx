'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import Input from '@/components/ui/Input/Input.jsx';

// Input de contraseña con botón Mostrar/Ocultar dentro del campo. Oculta por defecto.
export default function PasswordInput({ id, name, value, onChange, autoComplete = 'current-password', required, invalid, disabled, ...rest }) {
    const [visible, setVisible] = useState(false);
    const Icono = visible ? EyeOff : Eye;
    return (
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
            endAdornment={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-pressed={visible}
                    aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="-mr-2 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
                >
                    <Icono aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                </button>
            }
            {...rest}
        />
    );
}
