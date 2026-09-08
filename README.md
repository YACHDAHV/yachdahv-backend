# Yachdahv backend.

NestJS REST API for the Yachdahv frontend, backed by PostgreSQL and designed for deployment on Railway. Profile photos and private identity documents are uploaded directly to Cloudflare R2 through short-lived signed URLs.

## Included domains

- JWT authentication with rotating, persisted refresh tokens
- Resend email OTP, welcome, password-reset and identity-review emails
- Email verification and account recovery delivered through Resend
- Onboarding, profiles and match preferences
- Identity verification through Prembly (Nigerian NIN + liveness, or global government ID + liveness), with admin review as a fallback
- Match suggestions, likes, mutual matches and passes
- Conversations, messages and read state
- Notifications
- Blocking and user reports
- Super-admin dashboard, user moderation, verification and report queues
- R2 upload signing with separate public and private buckets
- Contact/support intake and audit logs
- Request validation, CORS, Helmet headers and rate limiting

All routes use the `/api` prefix. The health endpoint is `GET /api/health`.

## Local setup

1. Copy `.env.example` to `.env` and replace the JWT secrets.
2. Start PostgreSQL 17 using `docker compose up -d` or point `DATABASE_URL` to an existing PostgreSQL database.
3. Install dependencies with `npm install`.
4. Build and apply the schema:

```bash
npm run build
npm run db:migrate:dev
```

5. Optionally create local demo accounts:

```bash
npm run db:seed:dev
```

6. Start the API:

```bash
npm run start:dev
```

The default seeded password is `ChangeMe123!`; set `SEED_PASSWORD` before seeding any shared environment. Never seed production.

`DB_SYNCHRONIZE=true` is convenient for a disposable local database only. Production forcibly ignores synchronization and should always use migrations.

## Main API routes

| Area | Routes |
| --- | --- |
| Authentication | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` |
| Email | `POST /api/auth/email/request-code`, `/email/verify` |
| Onboarding | `GET /api/onboarding/me`, `PUT /api/onboarding/me` |
| Current user | `GET /api/users/me`, `PATCH /api/users/me/profile`, `PATCH /api/users/me/preferences`, `DELETE /api/users/me` |
| Matches | `GET /api/matches/suggestions`, `GET /api/matches`, `POST /api/matches/:memberId/like`, `/pass` |
| Messages | `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read` |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read-all`, `POST /api/notifications/:id/read` |
| Safety | `GET/POST/DELETE /api/safety/blocks`, `POST /api/safety/reports` |
| Verification | `GET/POST /api/verification`, `POST /api/verification/webhooks/prembly` |
| Uploads | `POST /api/uploads/presign` |
| Admin | `/api/admin/dashboard`, `/users`, `/verifications`, `/reports` |

Authenticated routes expect `Authorization: Bearer <accessToken>`.

## Cloudflare R2 uploads

Create two buckets:

- `R2_PUBLIC_BUCKET`: approved profile photos served through a custom media domain.
- `R2_PRIVATE_BUCKET`: identity documents and selfies; never expose this bucket publicly.

The client requests a signed upload URL from `POST /api/uploads/presign`, uploads directly to R2, and then stores the returned object key through the profile or verification endpoint. Enforce file-size limits in the client and at the Cloudflare layer, strip image metadata, and add malware/content scanning before marking documents as reviewed.

## Prembly identity verification

Add these Railway variables from your Prembly sandbox (or live) dashboard:

- `PREMBLY_API_KEY`: secret API key (`x-api-key`)
- `PREMBLY_APP_ID`: optional application id (`app-id`). NIN and liveness work with the API key alone; some document endpoints still send this header when present.
- `PREMBLY_BASE_URL`: `https://api.prembly.com` unless Prembly gives you a sandbox host
- `PREMBLY_PUBLIC_KEY`: optional, used to verify webhook signatures
- `PREMBLY_LIVENESS_MIN_CONFIDENCE`: optional, default `0.7`

Nigerian members submit an 11-digit NIN and a live selfie. The API runs Prembly face liveness, then NIN-with-face. Everyone else uploads a passport, driver's license, national ID or residence permit plus the same selfie; the API runs liveness and document-with-face. Successful checks mark the member verified immediately. If Prembly keys are missing, submissions stay in the admin review queue.

Set `IDENTITY_VERIFICATION_REQUIRED=true` when you want Discover and matching to require a verified identity.

## Railway deployment

Provision a PostgreSQL service and set `DATABASE_URL` from Railway's private database URL. Add every required variable from `.env.example`, set `DATABASE_SSL` according to the supplied connection string, and configure the frontend origin. The Docker image applies pending migrations before starting the API.

Use separate Railway environments and databases for staging and production. Enable PostgreSQL backups before accepting real user data.
