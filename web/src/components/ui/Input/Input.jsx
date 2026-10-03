import clsx from 'clsx';

// Base compartida por Input/Select/Textarea: 8 px de radio, borde de entrada, 40 px de alto y anillo de foco suave.
export const CONTROL_BASE =
    'w-full min-h-10 rounded-md border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground ' +
    'transition-[border-color,box-shadow] duration-150 ' +
    'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 ' +
    'disabled:bg-muted disabled:opacity-70';

// Campo de texto nativo; endAdornment se coloca a la derecha dentro del borde.
export default function Input({ type = 'text', invalid, endAdornment, className, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? 'border-destructive' : 'border-input';
    const input = <input type={type} className={clsx(CONTROL_BASE, borde, endAdornment && 'pr-10', !endAdornment && className)} {...rest} />;
    if (!endAdornment) return input;
    return (
        <div className={clsx('relative', className)}>
            {input}
            <span className="absolute inset-y-0 right-2 flex items-center text-muted-foreground">{endAdornment}</span>
        </div>
    );
}
