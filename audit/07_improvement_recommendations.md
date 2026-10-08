# 07 — Improvement Recommendations

**Overall conformance rating: PARTIAL.**

The system's spine — role-based access, the four-level electronic approval sequence, its
server-side enforcement, notifications, and the offline outbox — is genuinely implemented and, in
places, implemented better than the papers require. Four headline features named in the objectives
are not: **location/QR** (present only in the browser), **request photos** (never stored),
**automatic archiving** (a manual button), and **the PDF with all four approvals** (an endpoint
nobody calls, printing hardcoded names instead).

---

## 1. Scorecard

| Checklist item (reconstructed) | Status | One-line reason |
|---|---|---|
| A · Registration, approval, privacy | **DIFFERENT** | Approvals work; consent never written, ID photo broken |
| B · Roles & RBAC | **MATCH** | Flag-based Supervisor, DB-authoritative roles, IDOR guard |
| C · Location by QR / manual | **MISSING** | Registry empty + unreachable from UI; printed "QR" is an icon |
| D · Form, photo, urgent path | **PARTIAL** | Form and fast path conform; photo dropped at the payload |
| E · Four-level approval + audit log | **MATCH / PARTIAL** | Order enforced server-side; PDF and some audit rows missing |
| F · Statuses, tracking, notifications | **DIFFERENT** | 12 states vs 6+3; "real time" is a 30 s notification poll |
| G · Work orders & replacement flag | **DIFFERENT** | Assignment writes `Ongoing`, skipping `Approved` |
| H · Archiving | **MISSING** (automatic) | Only a manual admin button exists |
| I · Post-completion feedback | **PARTIAL** | Form + server validation work; local list, thin auto-prompt |
| J · ERD (10 tables) | **DIFFERENT** | 14 live tables; three paper tables absent as structures |
| K · Architecture & stack | **DIFFERENT / MATCH** | Tiers and offline match; no Tailwind vs Table 4 |
| L · Non-functional (25010 + RA 10173) | **PARTIAL** | Server security baseline strong; privacy and backup thin |

**Gaps:** 32 total — 7 × S1, 6 × S2, 14 × S3, 5 × S4 (23 📄 paper, 6 🔒 security/privacy, 3 neutral).

---

## 2. What is already good — protect it

These are strengths a reviewer should not be allowed to undervalue, and each is a **do-not-touch**
in the implementation plan:

1. **Single-file lifecycle policy.** `backend/src/utils/ticketPolicy.js:31-59` owns every
   transition; route handlers call `authorizeStatusChange` (`:178`) or `assertAgainstPolicy`
   (`:250`). The comment block at `:10-29` states the rule and the tests back it
   (`backend/tests/ticketPolicy.test.js`).
2. **Approval prerequisites are enforced server-side, not in the UI.** `missingApprovalFor`
   (`ticketPolicy.js:146-172`) gates `Under Review`, `Pending Final Approval`, `Approved` and
   `Ongoing` on the three approval flags — `ch3.md:7`'s "in sequence" is real.
3. **The `Awaiting Signatures` trap was closed deliberately.** `ticketPolicy.js:38-43` documents
   that confirming a wet-ink hardcopy used to skip the Approver and no longer does.
4. **IDOR and supervisor scope.** `canViewTicket` (`:79-91`), `canSuperviseTicket` (`:102-119`)
   with the blanket fall-through explicitly removed (`:112-118`), `applyVisibilityScope`
   (`requisitionRoutes.js:127-155`).
5. **Roles come from the database, not the JWT.** `auth.js:14-20, :35, :91`.
6. **Login hardening beyond the papers.** rate limit (`authRoutes.js:11`), lockout 5/15
   (`:35-37`), timing-equalised `DUMMY_HASH` (`:39-43`).
7. **Offline outbox with idempotency.** `outbox.js:26-34, 91-126, 138-167` + server replay
   (`requisitionRoutes.js:348-375`) — this fulfils `ch1.md:40` properly, not cosmetically.
8. **`/uploads` is no longer served statically** and the comment records why (`server.js:81-91`).
9. **Tri-party notifications on every status change** (`requisitionRoutes.js:1161-1189`) — matches
   `ch3.md:8` literally.
10. **High-Risk tickets sort first** (`requisitionRoutes.js:205-213`) — makes `ch1.md:103` visible.

---

## 3. Recommendations, ranked by value per unit risk

### Tier 1 — do these; high value, low-to-medium risk

| # | Recommendation | Closes | Effort | Note |
|---|---|---|---|---|
| R1 | **Persist `locationId` and populate `campus_locations`** (plan T-05 + T-06) | G-01, G-21, G-22 | M + L | One dropped field poisons every location report; 27 preset locations already exist in `QrCodeScannerModal.jsx:11-103` to seed from |
| R2 | **Fix the ID-photo path: size cap + correct field** (T-03) | G-06, G-07 | S | Two lines in `UserManagement.jsx` plus a client cap; closes two S1s |
| R3 | **Record consent** (T-02) | G-05 | M | Columns exist and are `NULL` on all 8 rows; needs a checkbox, one INSERT column, one copy step |
| R4 | **Auto-archive terminal tickets** (T-15) | G-03 | S | One line inside the existing transaction; the paper says "automatic" three times |
| R5 | **Replace the hardcoded approver names** (T-17 step 1) | part of G-10 | S | Independent of the Word/PowerShell dependency; makes every print truthful |
| R6 | **Rejection gets an audit row** (T-04) | G-11 | S | `ch1.md:104` names rejections explicitly |
| R7 | **Point Approval History at the database** (T-07) | G-23 | S | `setApprovalHistory` has zero call sites today |
| R8 | **Align the password rules** (T-08) | G-25 | XS | Client says 6, server says 8+letter+digit |

**Tier 1 total ≈ 2–4 days of work and closes 8 gaps, five of them S1.**

### Tier 2 — correct the workflow semantics

| # | Recommendation | Closes | Risk note |
|---|---|---|---|
| R9 | Assignment sets `Approved`; technician's "Start work" sets `Ongoing` (T-10) | G-09 | **Highest regression risk in the plan** — grep every `'Ongoing'` consumer first |
| R10 | Requester can revise & resubmit from `Returned` (T-11) | G-08 | The carve-out must be one narrow transition or it becomes an escalation path |
| R11 | Scope supervisor notifications to the unit (T-12) | G-15 | Low risk; `supervisor_id` is already written at `requisitionRoutes.js:462` |
| R12 | Real-time list refresh via the existing 30 s poll (T-13) | G-13 | Start with option (1); SSE only if 30 s proves too slow |
| R13 | Finish audit coverage (T-14) | G-27 | Append-only, near-zero risk |

### Tier 3 — build what is missing

| # | Recommendation | Closes |
|---|---|---|
| R14 | Store the request photo via the already-built `documentRoutes` (T-16) | G-02 |
| R15 | Wire `apiGetJobRequestDocPdf` and add the four-approval block to the DOCX generator (T-17) | G-10 |
| R16 | Enforce/flag the urgent same-day deadline server-side (T-18) | G-16 |
| R17 | Add `created_by` + location FK to preventive schedules (T-19) | G-17 |
| R18 | Recurring-issues report (T-20) — named in `ch1.md:104` but never built | G-26 |
| R19 | Scannable QR labels using the real `qr_code` values (T-21) | G-04 |

### Tier 4 — polish

| # | Recommendation | Closes |
|---|---|---|
| R20 | One shared status-label map (T-22) | G-14 (labels) |
| R21 | Profile then split the critical-path bundle (T-23) | G-31 |
| R22 | Retire or widen the chat module's gate (D9) | A1 |
| R23 | Remove dead code after its feature lands (T-28) | G-28 |
| R24 | Refresh `README.md:15-16` and `docs/API.md:32` (T-25) | G-29 |
| R25 | Scheduled backup, or reword `ch3.md:160` (T-26) | K10 / B11 |
| R26 | Consider `helmet`, or document the hand-rolled headers (T-30) | G-32 |

---

## 4. Security and privacy posture

**Strong:** fail-fast CORS (`server.js:31-41`), hand-rolled headers with `script-src 'self'`
(`:61-79`), no static upload serving (`:81-100`), DB-authoritative roles (`auth.js:35`), login
rate limit + lockout + timing equalisation (`authRoutes.js:11, :35-43`), upload allow-list and
10 MB cap (`documentRoutes.js:36-37`), user-scoped notifications (`notificationRoutes.js:16-72`),
IDOR guard (`ticketPolicy.js:79-91`), atomic ticket minting (`requisitionRoutes.js:23-35`).

**Needs attention, in order:**

1. **G-05 consent** — the stated RA 10173 mechanism is an unwritten column. This is the single
   largest privacy exposure because the papers explicitly promise it (`ch1.md:99`, `ch2.md:34`).
2. **G-07 base64 into `VARCHAR(500)` under non-strict SQL** — silent truncation with a 200
   response. `schema.sql:114-116` anticipated exactly this.
3. **G-06 the admin cannot see the ID they are approving** — inverts the purpose of the check.
4. **G-12 self-approval** — 🔒 only; the papers are silent (`05_extra` B6). A one-line guard in
   `assertAgainstPolicy` removes it.
5. **G-25 password rules disagree** between client and server.
6. **G-30 JWT in `localStorage`** — acceptable for this deployment class; revisit if the threat
   model changes (decision D6).

**Not counted against conformance:** items 4 and 6 are security findings, not paper gaps.

---

## 5. What to tell a reviewer

A defensible one-paragraph position:

> FixIT's approval workflow — the heart of the paper — is implemented and enforced on the server,
> with a single policy module, a timestamped audit trail, and an offline-capable submission path
> that the papers do not even require. Where the implementation diverges, it is almost always in
> the *data* half of a feature rather than the *behaviour* half: the location is chosen but not
> saved, the photo is taken but not stored, the archive is possible but not automatic, and the PDF
> exists but is not generated. Four code-level corrections (paper wording on Tailwind, the ERD's
> ten tables, the archiving model, and the missing self-approval sentence) and one build-out
> (persist location and photos) would bring the system to conformance.

---

## 6. Sequencing advice

* **Do not start with the PDF** (R15). It is the most visible gap but the most
  environment-dependent (`pdfGenerator.js:31-34` needs Windows + Word). R5 alone removes the worst
  symptom.
* **Do not start with T-10** (assignment → `Approved`). It is semantically important but has the
  broadest blast radius; do it once R1–R8 have landed and the regression checklist is green.
* **Bundle T-05 with T-06.** `locationId` cannot be set against an empty table, and a table
  populated but unread is equally useless. They are one change.
* **Decide D1–D5 before writing any code.** They change file lists and effort estimates.
* **Nothing here is committed.** The working tree carried 101 changed entries before this audit
  began; that is your prior work and it was not touched.

---

## 7. Two things this audit could not do, and why

1. **Run the test suites.** `backend npm test` (93 passing baseline) writes fixture rows into
   `fixit_pdas`; the frontend `chainSmoke` and `smokeLive` scripts archive and mutate tickets.
   The brief forbids tests that create, update or delete data without asking first — so they were
   not run. The prior phase's recorded results were read instead. See decision **D12**.
2. **Profile performance.** Measuring response times needs a running server and a load source;
   the brief forbids starting servers for this audit. L16 therefore reports static evidence only
   (bundle sizes, paging, body limits).

A third limitation is recorded up front in `00_summary.md`: the verbatim A–L checklist and
`~/fixit_papers/*.md` were **NOT FOUND**, so A–L was reconstructed from the papers' own requirement
statements and the extracted chapters in `%TEMP%\opencode\papers\` were used as the authoritative
source. Search terms for both absences are recorded there.
