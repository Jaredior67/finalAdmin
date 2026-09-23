# FixIT API Contract (localizedyam — Base `http://localhost:5000/api`, Bearer JWT)

Conventions: JSON in/out · generic error shape `{ "message": "..." }` ·
list endpoints are newest-first · ticket detail embeds `history`.

## Auth — `POST /api/auth/*` (public, rate-limited)

| Method & path | Body | Notes |
|---|---|---|
| `POST /api/auth/register` | firstName, lastName, email, password (min 8, letter+number), role ∈ faculty/staff | Creates a *pending* registration, not a user |
| `POST /api/auth/login` | email, password, role (portal key) | 5 failures → 15-min lockout; JWT default 8h |
| `POST /api/auth/logout` | — (Bearer) | Revokes the token server-side |

## Users — `/api/users` (PDAS Admin only)

`GET /` · `POST /` (same password rules) · `PUT /:id` · `PUT /:id/status`
(`active`/`inactive`) · `DELETE /:id` (soft-delete → `inactive`, never self) ·
`GET /registrations` · `PUT /registrations/:id/approve|reject`

## Job requests — `/api/job-requests` (Bearer; ownership enforced)

| Method & path | Who | Notes |
|---|---|---|
| `GET /?archived=&limit=&offset=` | requester / assignee / admin | Role-scoped; high-risk first; max 200/page |
| `POST /` | any signed-in user | description ≤ 5000, allow-listed category |
| `GET /:id` | owner / assignee / admin | IDOR-guarded |
| `PUT /:id/status` | admin (+ assigned tech for Ongoing→Completed only) | Transition map + signed-form gate enforced |
| `PUT /:id/signed-form` | admin | `{ confirmed, scanRef? }` — confirms the physical hardcopy |
| `PUT /:id/complete-standard-form` | requester or admin | Urgent follow-up details |
| `PUT /:id/replacement-flag` | admin or assigned tech | Procurement pipeline trigger |

Lifecycle: `Pending → Under Review → Awaiting Signatures → Approved → Ongoing → Completed`
(`Rejected` terminal from the review stages). **No digital signatures** — Approved/Ongoing
require `signed_form_confirmed = 1`. Every mutation writes `job_request_status_history`
and `audit_log`.

## Supporting resources

- `GET /api/evaluations` + `POST /api/evaluations` (requester-only, one per completed ticket)
- `GET|POST /api/messages`, `POST /api/messages/:id/replies` (sender/recipient only)
- `GET /api/notifications`, `PUT /:id/read`, `PUT /read-all` (own only)
- `POST /api/documents` (JPG/PNG/PDF ≤ 10 MB, renamed), `GET /job-request/:id`, `GET /:id/download` (owner chain)
- `GET /api/audit-log?limit=` (admin, newest first, max 500)
- `GET|POST /api/preventive-schedules`, `GET /api/lookups/*`, `GET /api/health`
