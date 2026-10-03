# SUSAN · web

Aplicación Next.js 16 (App Router, React 19, Tailwind 4, JavaScript). La documentación del proyecto está en la raíz del repositorio:
[`README.md`](../README.md), [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) y [`CLAUDE.md`](../CLAUDE.md) (convenciones).

```bash
npm install
npm run dev        # requiere variables de entorno (web/.env.example) o el modo local: ../scripts/dev-all.sh
npm test           # vitest
npm run lint
npm run build
```

Next 16 tiene cambios incompatibles (`proxy.js` en lugar de `middleware`, `params`/`cookies()` asíncronos): lee la guía relevante en
`node_modules/next/dist/docs/` antes de tocar código de Next (ver `AGENTS.md`).
