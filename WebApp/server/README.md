# Mosaico Web API

Servidor AdonisJS 7 de WebApp. T0 expone salud y capacidades de plataforma; procesamiento de assets y persistencia llegan desde T1.

## Desarrollo

Desde raiz del repositorio:

```powershell
pnpm dev:api
```

Endpoints T0:

- `GET /health`
- `GET /api/v1/capabilities`

Calidad:

```powershell
pnpm --filter @mosaico/web-server lint
pnpm --filter @mosaico/web-server typecheck
pnpm --filter @mosaico/web-server test
pnpm --filter @mosaico/web-server build
```

`.env` es local e ignorado. `.env.test` contiene solo clave determinista de pruebas, nunca credencial productiva.
