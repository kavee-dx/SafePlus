# Rescue Team Dispatch — Implementation Plan (Member 3, step 1)

Owner: kaveesha. Scope of this document: **incidents → team recommendation → dispatch →
status tracking**. Shelters, capacity prediction and the citizen-facing shelter list are a
later step and are deliberately not designed here.

## 1. What this feature is

A verified ground report becomes an incident. A District Officer opens it, sees the evidence
the citizen uploaded and where it happened on a map, and the system ranks the rescue teams
that could actually handle it. The officer picks one (or accepts the recommendation), the team
leader sees the assignment on their own dashboard and walks it through the mission stages, and
every stage moves the district board live.

```
Citizen report ──▶ DMC officer verifies (teammate's UC-02, already built)
                          │
                          ▼
             Verified incident (district + coords + photos)
                          │
                          ▼
        Officer opens "Verified incidents" on their dashboard
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
   Evidence photos   Response map      Ranked teams (score)
        └─────────────────┴──────────────────┘
                          │  officer confirms
                          ▼
                   DISPATCH created  ──▶ team availability locks to ON_DEPLOYMENT
                          │
                          ▼
        Team leader: ACCEPT ─▶ EN_ROUTE ─▶ ARRIVED ─▶ RESCUE_IN_PROGRESS ─▶ COMPLETED
                          │
                          ▼
        Officer's live operations list + district board update, every stage recorded
```

## 2. Where the incident comes from (already built by another member)

Read-only. We do not change UC-02.

| Fact | Consequence |
| --- | --- |
| `hazard_reports` carries `status = VERIFIED`, `location_lat/lng`, `landmark`, `affected_population`, `immediate_danger`, `severity_level`, `hazard_type` | This row **is** the incident. No new incidents table. |
| `report_attachments.file_url` stores a full **base64 data URL** (photos/videos), added by `amasha-hazard_report_uc02.sql` | The portal can render `<img src={dataUrl}>` directly. No upload server, no static file route. |
| `GET /api/reports/queue/verified` (amasha) returns those fields **plus attachments**; `GET /api/reports/verified` (dushani) returns them **without** | The dispatch view reads the extended record through the repository, not the thin dushani list. |
| Verification is done by DMC + district officers via `requireVerifier` | Our guard reuses the same role set so the two features cannot disagree about who is an officer. |

Current live data (checked against the running DB): 3 verified incidents — Colombo
`RPT-TEST-002` (landslide risk, CRITICAL, **no photo**), Gampaha `RPT-MUZHPAAX-APTE` (cyclone,
1 photo) and `RPT-MUZHBY2O-F1ND` (strong wind, 1 photo). 180 teams exist: 90 Colombo,
90 Gampaha, all with base coordinates. The UI must therefore handle "verified incident with no
evidence photo" and "no coordinates" gracefully, because both cases are real today.

## 3. Data model (new migration `kaveesha-rescue_dispatch.sql`)

`rescue_dispatches`

| Column | Notes |
| --- | --- |
| `id` UUID PK default `gen_random_uuid()` | |
| `dispatch_code` VARCHAR(24) UNIQUE | `DSP-YYMMDD-XXXX`, what the officer and leader both read out over the phone |
| `report_id` UUID → `hazard_reports(id)` ON DELETE CASCADE | the incident |
| `team_id` UUID → `team_leaders(id)` ON DELETE RESTRICT | mission history survives a team being removed |
| `dispatched_by` UUID → `users(id)` ON DELETE SET NULL | officer |
| `district` VARCHAR(80) | snapshot of the incident district, so the officer list stays a single indexed filter |
| `status` VARCHAR(24) | see state machine |
| `mission_notes` TEXT | officer's instruction |
| `recommendation_score` NUMERIC(5,2) | the score shown at dispatch time |
| `recommendation_factors` JSONB | why: distance, capability, workload, penalties — kept for audit/demo |
| `people_rescued` / `people_evacuated` INTEGER | filled at COMPLETED; this is what feeds shelter demand later |
| `decline_reason` / `cancel_reason` TEXT | |
| stage timestamps | `accepted_at, en_route_at, arrived_at, rescue_started_at, completed_at, returned_at, declined_at, cancelled_at` |
| `created_at`, `updated_at` | |

Constraints and indexes:

- `CHECK (status IN ('DISPATCHED','ACCEPTED','EN_ROUTE','ARRIVED','RESCUE_IN_PROGRESS','RETURNING','COMPLETED','DECLINED','CANCELLED'))`
- `CHECK` every stage timestamp only appears with its status reached (same idea as the
  `hazard_reports_verified_pair_check` the teammate already used).
- **Partial unique index on `(team_id) WHERE status IN ('DISPATCHED','ACCEPTED','EN_ROUTE','ARRIVED','RESCUE_IN_PROGRESS','RETURNING')`** — the database, not the app, guarantees a team cannot hold two live missions.
- Index on `(report_id)`, and a partial index on `(district, status)`.

`rescue_dispatch_events` — append-only audit trail for the timeline and for real-time replay:
`id, dispatch_id → rescue_dispatches ON DELETE CASCADE, from_status, to_status, actor_id,
actor_role, note, created_at`. Written in the same transaction as the status change.

## 4. Two different "statuses" — do not merge them

| Concept | Who owns it | Values |
| --- | --- | --- |
| `team_leaders.availability` | **team leader** (already live) | `AVAILABLE`, `ON_DEPLOYMENT`, `UNAVAILABLE` — "can we task us?" |
| `rescue_dispatches.status` | **officer started, leader advances** | the 9 states above — "where is this mission?" |

Coupling rules, enforced in the service inside one transaction:

- A dispatch reaches `DISPATCHED` → the team's availability is forced to `ON_DEPLOYMENT` (reserved, so no double-tasking).
- `DECLINED` / `CANCELLED` / `COMPLETED` → if the team has no other live dispatch, availability returns to `AVAILABLE`.
- A team marked `UNAVAILABLE` by its own leader is never offered as a candidate.

## 5. State machine

```
DISPATCHED ──▶ ACCEPTED ──▶ EN_ROUTE ──▶ ARRIVED ──▶ RESCUE_IN_PROGRESS ──▶ RETURNING ──▶ COMPLETED
     │                        │                        │
     │                        └────────────────────────┴──▶ COMPLETED   (skips allowed: short jobs)
     ▼
  DECLINED                                    any live state ──▶ CANCELLED (officer only)
```

Forward-only for the leader, with two legal shortcuts (`EN_ROUTE`/`ARRIVED` straight to
`COMPLETED` when the job ends without a rescue, e.g. access denied). `RETURNING` is optional.
Backwards transitions are rejected with a message that names the legal next steps.

## 6. Team recommendation engine (`kaveesha-teamRecommendationService.ts`)

Rule-based weighted score, deliberately explainable. Input: one incident. Output: ranked
candidates with the reasons attached.

**Gate first** (excluded, listed separately with the reason): not `ACTIVE`, not `AVAILABLE`,
already holding a live dispatch, no base coordinates.

| Factor | Weight | How it is measured |
| --- | --- | --- |
| Reach | 40 | Straight-line km from team base to incident, computed by **PostGIS** `ST_Distance(... ::geography)` (extension 3.6.4 is installed and currently unused — this is where it earns its place). Bands: ≤2 km 100, ≤5 88, ≤10 72, ≤20 55, ≤35 38, else 20. |
| Capability match | 30 | `team_type` matches the hazard → 100; a matching `capabilities[]` tag → 70; evacuation-only → 45; unrelated → 20. Hazard→team map covers FLOOD, LANDSLIDE(_RISK), CYCLONE, HEAVY_RAIN, STRONG_WIND, WILDFIRE, TSUNAMI, COASTAL_EROSION, EPIDEMIC, INDUSTRIAL_ACCIDENT, MEDICAL, OTHER. |
| Workload | 15 | 100 for no live dispatch; 50 for one completed-and-closed mission today; scaled down further after that. |
| Readiness | 15 | Equipment depth for that hazard (boat + life jackets for flood, search lights for night, first aid for medical), plus `member_count` against the incident's `affected_population`. |

Adjustments: `immediate_danger = true` or `CRITICAL` severity widens the pool to mutual-aid
teams after in-district ones; a team from another district keeps its score but is labelled
**Mutual aid**, and its reach component takes a ×0.85 penalty because the travel is real.

ETA is a stated heuristic, not a claim: `km ÷ road speed`, 32 km/h, 24 km/h for flood/fire and
20 km/h when the team's approach is by boat. The UI always says "as-the-crow-flies".

**Route awareness (honest v1).** No external routing API. The system checks what it actually
can: the incident point against the saved district boundary polygons
(`dushani-districtBoundaryService` already does point-in-district in TypeScript) and the
mutual-aid penalty above. A `routePenalty` multiplier (default 1.0) is threaded through the
score so an officer-maintained blocked-road layer can drop in later without rewriting the
engine. This is a documented limitation, which is a stronger position in a report than an
undeliverable promise.

## 7. API (new `kaveesha-dispatchRoutes.ts`, mounted at `/api/rescue-dispatch`)

| Endpoint | Guard | Purpose |
| --- | --- | --- |
| `GET /incidents` | `requireAuth` + `requireDispatchOfficer` | Verified incidents, **scoped server-side** to the officer's district (a DMC officer sees all). Light payload: no photos, `photoCount` instead. |
| `GET /incidents/:reportId` | same | Full record: evidence data URLs, coordinates, affected people, ranked candidates, live + past dispatches. |
| `POST /incidents/:reportId/dispatch` | same | `{ teamId, missionNotes? }` → creates the dispatch, reserves the team, writes the event, returns the dispatch. |
| `GET /dispatches` | same | Live operations for the officer, optionally `?status=active`. |
| `POST /dispatches/:id/cancel` | same | `{ reason }` → `CANCELLED`, releases the team. |
| `GET /mine` | `requireTeamLeader` | The leader's current assignment + history + legal next actions. |
| `POST /dispatches/:id/status` | `requireTeamLeader` | `{ status }` — validated against the machine and against `team_id = the caller's team`. |

Errors use the existing `ApiError` shape, so the portal's `unwrap()` keeps working. Reuse
`requireDistrictBoard`'s role set for `requireDispatchOfficer` so the board and dispatch cannot
drift apart on who counts as an officer.

## 8. Portal UI

**District Officer dashboard** ([kaveesha-DistrictOfficerDashboard.tsx](../dmc-portal/src/pages/kaveesha-DistrictOfficerDashboard.tsx))

1. `Verified incidents` (replaces today's text-only `VerifiedReportsView`): card list with the
   evidence thumbnail, hazard type, severity pill, landmark, affected population, verified
   time, and a live badge when a team is already on it.
2. Clicking a card opens the **incident workspace** in the same view: evidence gallery,
   `kaveesha-ResponseMap` (Leaflet, already a dependency — incident pin + candidate team pins,
   coloured by availability, mutual-aid pins dashed), and the ranked team list where each row
   shows the score, the breakdown, ETA and a **Dispatch** button. Teams that were excluded are
   listed underneath with the reason, because "why not" matters to an officer.
3. New nav entry **Operations**: live dispatches with a stage strip
   (DISPATCHED → … → COMPLETED), elapsed time, the team's contact details and a cancel action.

**Team leader dashboard** ([kaveesha-TeamLeaderDashboard.tsx](../dmc-portal/src/pages/kaveesha-TeamLeaderDashboard.tsx))

A first tab **Assignment**: current mission card (code, incident type/severity, district,
landmark, coordinates, affected people, the officer's note, who dispatched it and when) with
the stage buttons, plus a short history. When idle it says so plainly and shows the last closed
mission.

## 9. Build order — one step at a time, each verifiable

| # | Step | Done when | Status |
| --- | --- | --- | --- |
| 1 | Migration + dispatch model constants + `migrate.ts` entry | `npm run migrate` applies cleanly, tables and the partial unique index exist | ✅ done |
| 2 | Recommendation service (PostGIS distance + scoring) | A script ranks teams for `RPT-TEST-002` and the top team is the nearest flood-capable one | ✅ done (12 candidates ranked, 61 held out with reasons) |
| 3 | Repository + service + controller + routes + guards | HTTP: incidents list is district-scoped; dispatch → team flips to `ON_DEPLOYMENT`; leader transition advances the stage; second dispatch to a busy team is refused by the DB | ✅ done — `backend/kaveesha-checkRescueDispatch.ts`: **32 passed, 0 failed** |
| 4 | Portal API client + officer incidents workspace + map + Operations list | Officer logs in, sees the photo and the pin, dispatches a ranked team, sees it under Operations | ✅ done, browser-verified |
| 5 | Team leader Assignment tab | Leader accepts and walks the stages; the officer's Operations row moves without a reload | ✅ done, browser-verified |
| 6 | End-to-end verification (script + browser, both districts) | Colombo (no-photo incident) and Gampaha (photo incident) both complete a full mission to `COMPLETED`, team released afterwards | ✅ Colombo done end-to-end (dispatch → 6 stages → 6 rescued / 14 evacuated → team back to `AVAILABLE`). Gampaha still needs a photo incident dispatched in the browser to close this line |
| 7 | Socket.IO live status | Backend emits on every transition, portal subscribes and shows "🚑 RT-xx EN ROUTE → ARRIVED" without polling | ⏳ not started — the board refreshes on demand today |

Steps 1-3 are backend-only, so the data spine is provable before any pixels exist.
Real-time is deliberately last: the flow must work over plain REST first.

## 10. Not in this step

Shelters (registry, capacity, occupancy bands, shelter recommendation, predicted capacity), the
citizen-app shelter list, rescue notifications (needs an additive change to the shared
`notifications_type_check` constraint that another member owns), blocked-road reporting, and
the unified incident/hazard map. Each is its own step afterwards.
