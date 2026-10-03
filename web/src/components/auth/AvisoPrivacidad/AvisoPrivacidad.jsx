// Texto provisional: el aviso definitivo requiere revisión jurídica (spec 4.3).
export default function AvisoPrivacidad() {
    return (
        <p className="text-xs text-muted-foreground">
            <strong>Aviso de privacidad.</strong> El rostro es un dato personal sensible: solo se usa para registrar tu asistencia si
            tienes un consentimiento firmado y vigente. Sin consentimiento, tu asistencia se registra con pase de lista manual.
        </p>
    );
}
