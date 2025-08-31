# Digisign Flow API

[![CI](https://github.com/Armandomateus41/digital_backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Armandomateus41/digital_backend/actions/workflows/ci.yml)
[![Smoke](https://github.com/Armandomateus41/digital_backend/actions/workflows/smoke.yml/badge.svg)](https://github.com/Armandomateus41/digital_backend/actions/workflows/smoke.yml)
[![codecov](https://codecov.io/gh/Armandomateus41/digital_backend/branch/main/graph/badge.svg)](https://app.codecov.io/gh/Armandomateus41/digital_backend)
![Node](https://img.shields.io/badge/node-20.x-026e00?logo=node.js&logoColor=white)
![PNPM](https://img.shields.io/badge/pnpm-9.x-f69220?logo=pnpm&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11.0-e0234e?logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-0db7ed?logo=docker&logoColor=white)

[![Backend Deploy](https://img.shields.io/endpoint?url=https%3A%2F%2Fimg.shields.io%2Fbadge%2Fbackend--deploy-render-blue)](https://render.com)
[![Frontend Deploy](https://img.shields.io/endpoint?url=https%3A%2F%2Fimg.shields.io%2Fbadge%2Ffrontend--deploy-vercel-black)](https://vercel.com)

Backend NestJS (Node 20, TypeScript strict) para fluxo de assinatura de documentos (upload PDF, metadados Postgres, S3, JWT, RBAC, observabilidade e OpenAPI).

## Requisitos
- Node.js 20+
- PNPM 9+
- Postgres (Render ou local)
- (Opcional) MinIO/S3 para armazenamento de arquivos

## Variáveis de ambiente
Copie `.env.example` para `apps/api/.env` e ajuste conforme necessário.

Principais variáveis:
- `PORT=3000`
- `DATABASE_URL=postgresql://...` (Render: incluir `?sslmode=require`)
- `JWT_SECRET=...` e `JWT_EXPIRES_IN=15m`
- `CORS_ORIGINS=http://localhost:5173`
- `S3_ENDPOINT=http://localhost:9000` (MinIO), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `STRICT_STORAGE=false` (true bloqueia upload quando S3 indisponível)
- `LOG_LEVEL=debug`

## Scripts PNPM (raiz)
- `pnpm install` – instala dependências
- `pnpm dev` – inicia API em modo dev
- `pnpm build` – build da API
- `pnpm start` – inicia API
- `pnpm test` / `pnpm test:e2e` – testes unit/e2e
- `pnpm prisma:generate` – gera Prisma Client
- `pnpm prisma:migrate` – aplica migração (dev)

## Scripts PNPM (apps/api)
- `pnpm -F @digisign/api dev`
- `pnpm -F @digisign/api build`
- `pnpm -F @digisign/api start`
- `pnpm -F @digisign/api prisma:generate`
- `pnpm -F @digisign/api prisma:migrate`
- `pnpm -F @digisign/api prisma:deploy`
- `pnpm -F @digisign/api seed`
- `pnpm -F @digisign/api test:e2e`

## Como rodar (dev)
```
pnpm install
pnpm -F @digisign/api prisma:generate
pnpm -F @digisign/api prisma:migrate
pnpm dev
```
Swagger (dev): `http://localhost:3000/docs`

## Banco de dados (Render)
Use a URL externa do Render com SSL, exemplo:
```
DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
```
Aplique migrações e gere o client:
```
pnpm -F @digisign/api prisma:deploy
pnpm -F @digisign/api prisma:generate
pnpm -F @digisign/api seed
```

## S3/MinIO (opcional para dev)
Suba MinIO via Docker Compose e configure as variáveis `S3_*`.

## cURL de referência
- Login
```
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@local.test","password":"Admin@123"}'
```
- Upload
```
export TOKEN="<JWT>"
curl -i -s -X POST http://localhost:3000/admin/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-request-id: bff-upload-test-1" \
  -F "title=CLI Demo" \
  -F "file=@demo.pdf;type=application/pdf"
```
- Health
```
curl -s http://localhost:3000/health
```

## Deploy no Render (via Docker + render.yaml)
1) Certifique-se de que o `render.yaml` está na raiz (já incluso). No Render, crie um novo Web Service escolhendo "Use existing render.yaml".
2) Variáveis no Render (Edit > Environment):
   - `DATABASE_URL` (com `?sslmode=require`)
   - `JWT_SECRET`, `JWT_EXPIRES_IN`
   - `CORS_ORIGINS` (ex.: `https://seu-front.exemplo.com`)
   - `STRICT_STORAGE` (`false` por padrão)
   - (Opcional S3) `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
3) Pós-deploy (uma vez por ambiente):
```
pnpm -F @digisign/api prisma:deploy && pnpm -F @digisign/api seed
```
4) Verificação:
   - `GET /health` deve retornar `{"status":"ok",...}`
   - `GET /docs` (Swagger) disponível em não‑prod

## Testes e Cobertura
- Unit e e2e com Jest/Supertest
```
pnpm -F @digisign/api test -- --coverage
```
- A cobertura é publicada no Codecov pelo CI. Consulte: https://app.codecov.io/gh/Armandomateus41/digital_backend