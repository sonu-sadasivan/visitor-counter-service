# Visitor Counter API

Standalone Express API for the visitor counter. `GET /api/visits` reads the Azure Table row without modifying it. `POST /api/visits` performs an ETag-guarded update and retries optimistic-concurrency conflicts. The API also exposes `GET /health`.

## Architecture

- `routes/visits.ts` maps HTTP requests to the counter service.
- `services/counterService.ts` contains the counter use cases.
- `repositories/azureCounterRepository.ts` talks to Azure Table Storage. ETag conflicts and simultaneous first inserts are retried, with a bounded retry limit.
- `config/env.ts` validates configuration at startup. `app.ts` composes Helmet, exact-origin CORS, rate limiting, routes, and safe JSON errors.

## Requirements and local setup

Use Node.js 22 or later. Create the table once using an account with permission to provision tables:

```sh
az storage table create --name VisitorCounters --account-name <storage-account> --auth-mode login
```

This one-time infrastructure step is separate from API reads; `GET /api/visits` never creates a table or row. The service principal or managed identity needs the **Storage Table Data Contributor** role on the storage account.

Then:

```sh
cd be-service
npm ci
cp .env.example .env
```

Set `AZURE_STORAGE_ACCOUNT_NAME` and `FRONTEND_ORIGIN` in `.env`. Authenticate locally with `az login`; `DefaultAzureCredential` uses Azure CLI credentials when available. In production, set `NODE_ENV=production` and enable the Container App's system-assigned managed identity; the service uses `ManagedIdentityCredential`. No storage key or connection string is used.

Environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure Table Storage account name | required |
| `FRONTEND_ORIGIN` | Exact browser origin allowed by CORS | required |
| `PORT` | HTTP listening port | `3000` |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in milliseconds | `60000` |
| `RATE_LIMIT_MAX` | Requests per IP and window on `/api/visits` | `100` |

## Run and verify

```sh
npm run dev
npm test
npm run build
npm start
```

Responses use `{ "count": number }` for visits, `{ "status": "healthy" }` for health, and a generic `{ "error": { "code": string, "message": string } }` shape for failures. Storage errors return HTTP 500 without exposing exception details; rate limits return HTTP 429.

## Docker

```sh
docker build -t visitor-counter-api .
docker run --rm -p 3000:3000 \
  -e AZURE_STORAGE_ACCOUNT_NAME=<storage-account> \
  -e FRONTEND_ORIGIN=https://<your-frontend-origin> \
  -e NODE_ENV=production visitor-counter-api
```

The multi-stage image runs as a non-root user, listens on `PORT` (default 3000), and includes an HTTP health check. Pass configuration at runtime; `.env` files are excluded from the build context.

## Azure Container Apps deployment

1. Build and publish the image to GitHub Container Registry (`ghcr.io/<owner>/<image>:<tag>`). Authenticate Docker with a GitHub token that has `write:packages`, then run `docker push` for that tag.
2. Create or update the Container App to use the published image and expose ingress on port 3000.
3. Enable its system-assigned managed identity.
4. Assign **Storage Table Data Contributor** to that identity at the storage account scope.
5. Configure `AZURE_STORAGE_ACCOUNT_NAME`, `FRONTEND_ORIGIN`, `NODE_ENV=production`, and optionally `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` as Container App environment variables.
6. Confirm the Container App health probe targets `/health`, then configure the frontend's `VITE_API_BASE_URL` to the app's HTTPS origin.

No Azure resources are provisioned automatically by this project.
