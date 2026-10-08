# 05 — Extras in the Code, and Corrections the Papers Need

Two halves:

* **Part A** — things the implementation has that no paper statement requires (EXTRA). These are
  *not* defects; several are genuine improvements. They matter because a reviewer comparing code to
  papers will find them unexplained.
* **Part B** — places where **the papers themselves** are internally inconsistent, factually stale,
  or in tension with their own later chapters. These are correction candidates for the manuscript,
  not code work.

Nothing in this file is a recommendation to delete working code.

---

# Part A — EXTRA in the implementation

## A1. Direct messaging module (`messages` / `message_replies` / CommunicationBox)

**Search against the papers:** grep `messag|chat|inbox|correspond` across `ch1.md, ch2.md, ch3.md`
→ only `ch3.md:45`, `ch3.md:90` ("messages that each role exchanges with the web interface, the
system modules" — UML sequence-diagram messages, not end-user chat) and `ch3.md:116`
(`tbl_notification`). **No paper statement describes an in-app chat.**

**What exists:**

| Piece | Citation |
|---|---|
| Tables | `messages`, `message_replies` (live 14-table list) |
| Routes | `backend/src/routes/messageRoutes.js` — participants gate `:15` `requireRole('admin','campus_admin','maintenance','technician')`, inbox `:36` |
| Mounted | `server.js:126` |
| UI | `frontend/src/views/CommunicationBox.jsx`, `frontend/src/views/faculty/FacultyCommunication.jsx`, nav entry `frontend/src/navigation/facultyNavigation.js` |

**Observations worth recording:**

1. The participants gate at `messageRoutes.js:15` excludes `faculty` and `staff`, yet the UI ships
   `FacultyCommunication.jsx`. A faculty account calling the inbox gets **403**. (Grep the route
   string and the component both exist; the mismatch is a defect inside an EXTRA feature, so it is
   logged here rather than in `04_gap_analysis.md`.)
2. The gate is not scoped to the assigned technician — any `maintenance`/`technician` account may
   thread with anyone in the participant list.
3. The papers' only sanctioned channel for "the parties concerned" is `tbl_notification`
   (`ch3.md:116`), which is implemented and correctly scoped (`notificationRoutes.js:16-72`).

**Recommendation:** keep it, but either widen the gate to the two roles the UI serves, or remove
the faculty-facing entry. It is not a conformance failure either way.

---

## A2. `Awaiting Signatures` status and the signed-form confirmation flow

**Search against the papers:** grep `Awaiting|signed form|wet-ink|hardcopy` across the three
chapters → the only hits are `ch1.md:27` (PNPKI background), `ch1.md:103` and `ch1.md:120`
(electronic approvals are *not* certificate-based), `ch1.md:154` (limitations).
**The status itself appears nowhere.**

**What exists:**

| Piece | Citation |
|---|---|
| Status value | live enum (12 values); normalised at `requisitionRoutes.js:109` |
| Endpoint | `PUT /:id/signed-form` `requisitionRoutes.js:1216`, `requireRole('admin','campus_admin')` |
| Guard | only legal in `Under Review` / `Awaiting Signatures` — `requisitionRoutes.js:1228-1230` |
| Column triple | `signed_form_confirmed`, `signed_form_confirmed_by`, `signed_form_confirmed_at` (DB `SHOW COLUMNS`) |
| Deliberate design note | `ticketPolicy.js:38-43` — `Awaiting Signatures` deliberately does **not** lead to `Approved`; it funnels into `Pending Final Approval` so confirming a wet-ink hardcopy cannot skip the Approver |

**Assessment:** a sensible operational addition (the campus still routes a printed form), and the
policy comment shows it was wired defensively. It is EXTRA; the papers' six-stage list
(`ch1.md:104`) would need a sentence to cover it, or the status should be treated as an
implementation-only sub-state of `Under Review`.

---

## A3. Superseding status values: `Draft`, `Pending Supervisor Approval`

**Search:** grep `Draft|draft` near a status in `ch1.md:104` → `ch1.md:102` says "If the requester
does not confirm, the request **stays as a draft**". So `Draft` is paper-grounded as a
non-status-yet state; promoting it to a real enum value is an EXTRA choice. `Pending Supervisor
Approval` is not named in the papers — `ch3.md:7` says the request "goes through four electronic
approvals in sequence" without naming the wait state.

**Citation of use:** `ticketPolicy.js:32` and `:35`; queue driver comment at `:33-34`; read-back
`requisitionRoutes.js:145` (`jr.status = "Pending Supervisor Approval"`).

**Assessment:** EXTRA, harmless, and arguably clearer than overloading `Pending`. Note that
`docs/API.md:32` and `README.md:15-16` still describe the old six-stage chain and should be
refreshed (G-29).

---

## A4. Two maintenance role values for one paper role

**Paper:** `ch1.md:97` — **one** role, "Maintenance Personnel".

**Implementation:** `users.role enum('admin','campus_admin','faculty','staff','maintenance',
'technician')` (DB `SHOW COLUMNS`) — six values for four paper roles.

**Mapping (reconciled in code):**

| Paper role | DB value(s) | Evidence |
|---|---|---|
| Faculty/Staff (requester) | `faculty`, `staff` | `registration_requests.role enum('faculty','staff')`; `authRoutes.js:122-129` |
| Immediate Supervisor (designated) | `faculty`/`staff` + `is_supervisor = 1` | `auth.js:41`, `auth.js:107-110` |
| System Administrator (PDAS Head) | `admin` | `requireRole('admin')` throughout |
| Approver (Campus Administrator) | `campus_admin` | `requisitionRoutes.js:827` |
| Maintenance Personnel | `maintenance`, `technician` | `requisitionRoutes.js:953` accepts both; `ticketPolicy.js:71` `isTech = role === 'maintenance' \|\| role === 'technician'` |

**Assessment:** EXTRA, benign — `isTech()` treats them as one. Worth a footnote so a reviewer does
not read six roles into a four-role paper.

---

## A5. `registration_requests` as a staging table

**Paper:** `ch1.md:97` describes the approval loop but not a table; `ch3.md:116` lists the ten ERD
tables and does not include one.

**Implementation:** `registration_requests` (live), schema at `schema.sql:60-90`; written by
`authRoutes.js:147-167`, consumed by `userRoutes.js:28-107`.

**Assessment:** EXTRA and clearly necessary — you cannot approve an account that has not been
staged. `ch3.md:112` ("ten tables") would need updating to eleven (or thirteen counting the two
sequence tables).

---

## A6. Sequence tables for concurrency: `ticket_sequences`, `tracking_sequences`

**Paper:** silent; `ch1.md:35` only requires "ticket generation".

**Implementation:** `requisitionRoutes.js:494` (ticket number, in-transaction) and
`:984-997` (tracking number, reusing `official_tracking_no` when already minted).

**Assessment:** EXTRA, good. Directly supports the non-functional requirement for correctness under
concurrent use (`ch3.md:118`).

---

## A7. Offline outbox with idempotency keys

**Paper:** `ch1.md:40` "support offline request drafting through local browser caching, with
automatic synchronization and submission once connectivity is restored"; `ch1.md:154` notes full
functionality needs connectivity.

**Implementation:** `frontend/src/utils/outbox.js` — key minting `:26-34`, bounded queue of 20
`:23`, sequential flush `:91-126`, `submitOrQueue` `:138-167`; auto-flush on `online`
`OfflineBanner.jsx:40, 52, 122`; server replay `requisitionRoutes.js:348-375` backed by a unique
index on `idempotency_key`.

**Assessment:** **MATCH, not extra** — listed here only because the *idempotency key* mechanism is
an implementation choice the papers do not specify. It is the right one.

---

## A8. `documents` table + upload API with no caller

See `04_gap_analysis.md` G-02. EXTRA infrastructure, currently inert (0 rows, no frontend
`FormData`). It is the natural home for the photo feature when G-02 is closed.

---

## A9. Good EXTRAs worth naming explicitly

| Feature | Citation | Why it earns its place |
|---|---|---|
| Timing-equalised login (`DUMMY_HASH`) | `authRoutes.js:39-43` | defeats account enumeration by response timing |
| Account lockout 5 fails / 15 min | `authRoutes.js:35-37` | beyond what the papers ask |
| Fail-fast CORS | `server.js:31-41` | refuses to boot on a misconfigured origin |
| `/uploads` explicit deny | `server.js:81-100` | documents and blocks a prior exposure |
| `prefers-reduced-motion` | `index.css:1820` | accessibility, unrequested |
| Skip link | `SkipLink.jsx` | accessibility, unrequested |
| High-Risk-first ordering | `requisitionRoutes.js:205-213` | makes `ch1.md:103`'s urgency intent actually visible |
| Lazy role workspaces | `App.jsx:16-19` | keeps first paint small |
| `oxlint` zero-error baseline | `frontend/package.json:9` | regressions are caught cheaply |

---

# Part B — Corrections the papers need

> Each item cites both sides. **These are manuscript issues, not code gaps.** None is listed in
> `04_gap_analysis.md`.

## B1. Contradiction — who may self-register

| Side | Statement |
|---|---|
| `ch1.md:97` | "faculty and staff register an account… The same personal and employment details are required of maintenance personnel. **However, their accounts are created and encoded by the System Administrator instead of through self-registration**…" |
| `ch1.md:100` | "**Registration collects** the full name, age, gender, address, birthday, office or department, contact number, email, and a valid ID." (reads as if it covers all registrants) |

**Implementation follows `ch1.md:97`:** `authRoutes.js:122-129` restricts self-registration to
faculty/staff, and `registration_requests.role enum('faculty','staff')` makes any other value
impossible. Admin-created accounts come from `userRoutes.js:130`.

**Correction needed:** make `ch1.md:100` say explicitly that it describes the *faculty/staff* form,
or add "for faculty and staff" as `ch1.md:97` already does. As written, a reader can reasonably
expect a maintenance self-registration path that the papers elsewhere forbid.

## B2. Stale stack statement — "React.js with Tailwind CSS"

| Side | Statement |
|---|---|
| `ch3.md:41` | "a responsive web application using Node.js with Express as the back-end framework, **React.js with Tailwind CSS** for the front end, and MySQL" |
| `ch3.md:41` (methodology) | "using Node.js with Express, **React.js with Tailwind CSS**, and MySQL" |
| `ch3.md:146` (Table 4, Software Specification) | front-end framework listed as **React.js with Tailwind CSS** |

**Implementation:** `frontend/package.json:13-28` — no `tailwindcss`, no `@tailwind/*`, no
`postcss` config. Grep `tailwind` in `frontend/` → **no matches**. Styling is a hand-written token
system in `frontend/src/index.css` (46 `@media` rules).

**Correction options:** (a) change the three mentions to "React.js with a custom CSS design system",
or (b) actually adopt Tailwind. (a) is honest and cheap; (b) is a re-platform with no functional
benefit. **Recommend (a).**

## B3. ERD table count — ten tables described, more needed

`ch3.md:112` "the ERD, which has **ten tables**"; `ch3.md:115-116` names them; `ch3.md:160` repeats
"the **ten tables** described in the ERD (Figure 17)".

The live schema has **14** (`SELECT COUNT(*)` → `14`):

| Beyond the ten | Why it exists |
|---|---|
| `registration_requests` | the approval loop in `ch1.md:97` requires a staging table |
| `documents` | intended home for photos (see G-02) |
| `messages`, `message_replies` | the EXTRA chat module (A1) |
| `ticket_sequences`, `tracking_sequences` | collision-free numbering (A6) |

Also, two of the paper's ten are **not** present as tables: `tbl_work_order` and
`tbl_replacement_flag` are folded into `job_requests` (G-20), and `tbl_approval` has no structural
equivalent (G-19).

**Correction needed:** either redraw Figure 17 with the real shape, or add a sentence that
`tbl_work_order`, `tbl_replacement_flag` and `tbl_approval` are *modelled as attributes of*
`tbl_maintenance_request` / `tbl_job_request_status_history`. The current text asserts structures
the code does not have.

## B4. `tbl_location` "together with their QR codes" vs no `qr_code` column

`ch3.md:115`: "The **tbl_location** table lists the buildings, offices, and areas of the campus
**together with their QR codes**."

Live `campus_locations` (`schema.sql:88-95`): `id, building, floor, room, description, created_at`.
Grep `qr_code` in `backend/` → **no matches**.

**Correction needed:** this is the one place where the paper is *ahead* of the code and should not
be weakened — instead it is a requirement the implementation must meet (G-01, G-04, G-21, G-22).
Recorded here so the reviewer sees that the paper is the stricter of the two.

## B5. "Automatic" archiving stated three times, implemented never

| Statement | Citation |
|---|---|
| "the ticket **is archived** without being deleted, while rejected requests are archived in the same way" | `ch1.md:104` |
| "moves completed or rejected maintenance requests into a separate, retrievable record store" | `ch1.md:114` |
| "completed and rejected requests are moved to a separate record store" | `ch2.md:32` |

**Tension inside the papers:** `ch1.md:114` and `ch2.md:32` say "separate record store";
`ch3.md:115` says "`is_archived` and `archived_at` fields mark archived tickets, **so archived
records stay in the same table**". Those two descriptions disagree.

**Implementation matches `ch3.md:115`** — flags on the same table (`schema.sql` `job_requests`),
retrieved via `?archived=true` (`requisitionRoutes.js:160`).

**Correction needed:** pick one wording (the `ch3.md:115` version matches the code), and either add
the auto-archive behaviour or soften "automatic" in `ch1.md:104`. The code gap itself is G-03.

## B6. The paper never says a Supervisor may not approve their own request

grep `own request|self-approv|separation of duties` across all three chapters → **no match**.

The nearest statements are structural: `ch1.md:102` (the requester's confirmation doubles as the
supervisory confirmation when the requester *is* the Supervisor) and `ch3.md:7` (four approvals in
sequence).

**Implication:** the missing self-approval guard on the admin/approver legs (G-12) is a
**security finding, not a conformance failure**. If the paper intends to forbid it, a sentence in
`ch3.md:7` or the requirements paragraph (`ch3.md:118`) would close the gap on both sides at once.

## B7. Maintenance-personnel registration — internal restatement risk

`ch1.md:97` is unambiguous and the code matches it (A/B1). `ch3.md:6` likewise: "their accounts are
created and encoded by the System Administrator." No code change needed; see B1 for the one
sentence that implies otherwise.

## B8. Five ISO/IEC 25010 characteristics vs four on the feedback form

| Side | Statement |
|---|---|
| `ch1.md:42` | evaluate acceptability on **five** characteristics: functional suitability, usability, reliability, performance efficiency, security |
| `ch3.md:118` | the same five for the requirements paragraph |
| `ch3.md:160` | the in-system feedback form "collects feedback on **individual maintenance requests**" — separate from the study questionnaire |
| `EvaluationForm.jsx:6-11` | scores **four**: functional suitability, usability, reliability, performance efficiency |

**Assessment:** probably *correct* as built — the paper itself separates the per-ticket feedback
form from the acceptability questionnaire, and security is not something a requester can judge
from a repair job. **Open question for the user** rather than a defect: should the per-ticket form
carry a fifth "security/privacy of my data" item, or should `ch1.md:42` note that Security is
measured only by the study instrument?

## B9. Paper's process narrative omits the waiting states the code needs

`ch1.md:104` and `ch3.md:8` list six stages. The code needs two more to be honest about where a
ticket sits (`Pending Supervisor Approval`, `Pending Final Approval`) plus `Draft`, `Awaiting
Signatures`, `On Hold`, `Returned`, `Rejected` — 12 in total (G-14).

**Correction needed:** one sentence in `ch1.md:104` clarifying that the six are the *happy-path*
stages and the others are wait/exception states, plus a consistent label ("Returned for Revision"
in the paper vs `Returned` in the badge, `StatusBadge.jsx:41`).

## B10. Reminder lead time is unspecified

grep `one day|day before|24 hours|advance` across the chapters → **no reminder-specific hit**.
`ch3.md:83` only says "when the scheduled date of a task approaches".

**Not a defect either side.** Recorded so the reviewer does not mistake the code's two-day window
(`preventiveRoutes.js:165`) for a deviation from a stated number. If the paper intends a specific
lead time, say so; otherwise the code is free to tune it.

## B11. `ch3.md:160` promises a scheduled backup that nothing implements

"A **scheduled backup** of the database and the stored files protects against loss."

grep `mysqldump|backup` in `backend/` → **no script**. Only `README.md:317-318`, a manual command.

**Correction options:** (a) implement a scheduled backup (implementation-plan task), or (b) change
the sentence to describe the documented manual procedure. This one is on the code side if the
sentence stays — tracked as K10 / G-29.

---

## Summary table — Part B

| # | Type | Issue | Resolution |
|---|---|---|---|
| B1 | contradiction | `ch1.md:100` reads as if maintenance self-registers | add "for faculty and staff" to `ch1.md:100` |
| B2 | stale | "React.js with Tailwind CSS" ×3 (`ch3.md:41`, `:146`) | reword; code has no Tailwind |
| B3 | inaccurate | "ten tables" (`ch3.md:112`, `:160`) vs 14 live | redraw Figure 17 or note the folded/extra tables |
| B4 | stricter than code | `tbl_location` "with their QR codes" (`ch3.md:115`) | **code must catch up** (G-04/G-21) |
| B5 | internal conflict | "separate record store" (`ch1.md:114`, `ch2.md:32`) vs "same table" (`ch3.md:115`) | adopt the `ch3.md:115` wording |
| B6 | silent | no self-approval prohibition anywhere | add a sentence, or keep G-12 framed as security |
| B7 | restatement | maintenance registration restated safely in `ch3.md:6` | no action beyond B1 |
| B8 | ambiguity | five characteristics vs four form criteria | **user decision** |
| B9 | incomplete | six stages vs 12 states | add the "happy path + exceptions" sentence |
| B10 | unspecified | reminder lead time | leave open; code is free (`preventiveRoutes.js:165`) |
| B11 | promise | scheduled backup (`ch3.md:160`) | implement or reword (G-29) |
