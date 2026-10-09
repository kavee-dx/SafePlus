/* ------------------------------------------------------------------ *
 * Temporary end-to-end check for UC-03 dispatch and the district desk.
 * The officer tasks the top-ranked team, the leader walks the mission,
 * availability is reserved and handed back, the trail is complete — and
 * the district's acceptance is written as its own record without ever
 * touching the DMC officer's verification.
 * ------------------------------------------------------------------ */

import pool from "./config/db";

const BASE = process.env.SEED_API_BASE ?? "http://localhost:5000/api";
const OFFICER = { email: "district.test@safeplus.lk", password: "District@123" };
const SEED_PASSWORD = "SafePlus@2026";
/** The one handover line this probe writes, so it can find and remove it again. */
const PROBE_HANDOVER =
  "Second shift: the boat from the Mundal main office is still wanted.";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}

interface Reply {
  status: number;
  data: any;
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {}
): Promise<Reply> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  let data: unknown = null;

  try {
    data = text === "" ? null : JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data: data as any };
}

async function login(email: string, password = SEED_PASSWORD): Promise<string | null> {
  const response = await call("POST", "/auth/login", {
    body: { email, password, interface: "DMC_PORTAL" },
  });

  if (response.status !== 200 && response.status !== 201) {
    console.log(`  (login ${email} failed: ${response.status} ${JSON.stringify(response.data)?.slice(0, 160)})`);

    return null;
  }

  return (response.data?.token ?? response.data?.data?.token) as string | null;
}

async function availabilityOf(teamId: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT availability FROM team_leaders WHERE id = $1 LIMIT 1",
    [teamId]
  );

  return result.rows[0]?.availability ?? null;
}

async function cleanProbeMissions(label: string): Promise<void> {
  // The desk probe writes an acceptance line for the incident it takes on, and
  // one stray row if the district-scope guard ever fails. Both are removed with
  // the missions so a rerun starts from an untaken incident.
  await pool.query(
    `DELETE FROM district_incident_acceptance
      WHERE report_id IN (
        SELECT id FROM hazard_reports WHERE report_id = 'RPT-TEST-002'
      )
         OR handover_note = $1`,
    [PROBE_HANDOVER]
  );

  // Leave no residue. Two statements, not one: a data-modifying CTE is not
  // visible to the rest of the same statement, so a NOT EXISTS guard inside it
  // would still see the rows it just deleted.
  const teams = await pool.query(
    `SELECT DISTINCT team_id FROM rescue_dispatches
      WHERE report_id = (SELECT id FROM hazard_reports WHERE report_id = 'RPT-TEST-002')`
  );

  await pool.query(
    `DELETE FROM rescue_dispatches
      WHERE report_id = (SELECT id FROM hazard_reports WHERE report_id = 'RPT-TEST-002')`
  );

  for (const row of teams.rows as { team_id: string }[]) {
    await pool.query(
      `UPDATE team_leaders SET availability = 'AVAILABLE', updated_at = NOW()
        WHERE id = $1 AND availability = 'ON_DEPLOYMENT'
          AND NOT EXISTS (
            SELECT 1 FROM rescue_dispatches d
             WHERE d.team_id = team_leaders.id
               AND d.status IN ('DISPATCHED','ACCEPTED','EN_ROUTE','ARRIVED','RESCUE_IN_PROGRESS','RETURNING')
          )`,
      [row.team_id]
    );
  }

  console.log(`  (${label}: cleaned ${teams.rowCount ?? 0} probe mission(s))`);
}

async function main() {
  await cleanProbeMissions("start");

  console.log("\n1. the officer signs in and reads verified incidents");
  const officerToken = await login(OFFICER.email, OFFICER.password);

  check("officer login", Boolean(officerToken));

  if (!officerToken) {
    await pool.end();

    return;
  }

  const incidents = await call("GET", "/rescue-dispatch/incidents", {
    token: officerToken,
  });

  check("incidents respond", incidents.status === 200, `status ${incidents.status}`);

  const list = (incidents.data?.incidents ?? []) as {
    id: string;
    reportId: string;
    locationDistrict: string;
    photoCount: number;
    thumbnailUrl?: string | null;
    dispatchCount?: number;
    liveDispatchCount?: number;
    acceptedAt?: string | null;
    acceptedByName?: string | null;
    handoverNote?: string | null;
  }[];

  check(
    "only this officer's district comes back",
    list.length > 0 && list.every((item) => item.locationDistrict === "Colombo"),
    list.map((item) => `${item.reportId}/${item.locationDistrict}`).join(", ")
  );

  const incident = list.find((item) => item.reportId === "RPT-TEST-002");

  check("the verified Colombo landslide-risk incident is there", Boolean(incident));

  if (!incident) {
    await pool.end();

    return;
  }

  /* The incident desk is built on this one roll: a thumbnail for the list and
     the mission counts behind its pipeline. Optional fields are left out of the
     JSON entirely until they have a value, so only the counts are asserted. */
  check(
    "the roll carries the desk's counts",
    typeof incident.dispatchCount === "number" &&
      typeof incident.liveDispatchCount === "number" &&
      typeof incident.photoCount === "number",
    `dispatchCount ${incident.dispatchCount}, live ${incident.liveDispatchCount}, photos ${incident.photoCount}`
  );
  check(
    "the roll carries a real thumbnail for an incident with photos",
    incident.photoCount === 0 ||
      (typeof incident.thumbnailUrl === "string" && incident.thumbnailUrl.startsWith("data:")),
    `photoCount ${incident.photoCount}, ${String(incident.thumbnailUrl).slice(0, 24)}`
  );
  check(
    "a fresh incident has not been taken on by anyone",
    !incident.acceptedAt && !incident.handoverNote,
    `acceptedAt ${String(incident.acceptedAt)}`
  );

  console.log("\n2. the ranking engine answers for that incident");
  const ranked = await call(
    "GET",
    `/rescue-dispatch/incidents/${incident.reportId}/recommendations`,
    { token: officerToken }
  );

  check("recommendations respond", ranked.status === 200, `status ${ranked.status}`);

  const candidates = (ranked.data?.candidates ?? []) as {
    teamId: string;
    teamName: string;
    teamType: string;
    score: number;
    distanceKm: number;
    etaMinutes: number;
    breakdown: Record<string, number>;
  }[];
  const excluded = (ranked.data?.excluded ?? []) as unknown[];

  check("teams are offered", candidates.length > 0, `${candidates.length} ranked`);
  check(
    "unavailable teams are held back with a reason",
    excluded.length > 0,
    `${excluded.length} excluded`
  );
  check(
    "the first pick is a Landslide Rescue team for a landslide incident",
    candidates[0]?.teamType === "Landslide Rescue",
    `${candidates[0]?.teamName} (${candidates[0]?.teamType}) score ${candidates[0]?.score} at ${candidates[0]?.distanceKm} km`
  );
  check(
    "scores never rise down the list",
    candidates.every((row, index) => index === 0 || candidates[index - 1].score >= row.score)
  );

  const target = candidates[0];

  console.log("\n3. the officer dispatches that team");
  const created = await call(
    "POST",
    `/rescue-dispatch/incidents/${incident.reportId}/dispatch`,
    {
      token: officerToken,
      body: {
        teamId: target.teamId,
        missionNotes: "Two families cut off behind the slip. Take ropes and the drone.",
        recommendationScore: target.score,
        recommendationFactors: { distanceKm: target.distanceKm, etaMinutes: target.etaMinutes },
      },
    }
  );

  check("dispatch is accepted", created.status === 201, `status ${created.status} ${created.data?.message ?? created.data?.errors?.teamId ?? ""}`);

  const roll = created.data?.dispatch as
    | { id: string; dispatchCode: string; status: string; teamId: string }
    | undefined;

  if (!roll) {
    await pool.end();

    return;
  }

  check(
    "a readable reference is issued",
    /^DSP-\d{6}-[0-9A-F]{6}$/.test(roll.dispatchCode),
    roll.dispatchCode
  );
  check("it opens at DISPATCHED", roll.status === "DISPATCHED", roll.status);

  console.log("\n4. the team is reserved while the mission is live");
  check(
    "the team row reads ON_DEPLOYMENT",
    (await availabilityOf(roll.teamId)) === "ON_DEPLOYMENT",
    `availability ${await availabilityOf(roll.teamId)}`
  );

  const board = await call("GET", "/rescue-teams/district-board?scope=district", {
    token: officerToken,
  });

  check(
    "the district board counts the deployment",
    (board.data?.data?.summary?.onDeployment ?? 0) >= 1,
    `onDeployment ${board.data?.data?.summary?.onDeployment}`
  );

  console.log("\n5. the same team cannot be tasked twice");
  const clash = await call(
    "POST",
    `/rescue-dispatch/incidents/${incident.reportId}/dispatch`,
    { token: officerToken, body: { teamId: target.teamId } }
  );

  check("the repeat dispatch is refused", clash.status === 409, `status ${clash.status}: ${clash.data?.message}`);

  console.log("\n6. the team leader walks the mission");
  const leaderRow = await pool.query(
    "SELECT u.email FROM users u JOIN team_leaders t ON t.user_id = u.id WHERE t.id = $1 LIMIT 1",
    [roll.teamId]
  );
  const leaderEmail = leaderRow.rows[0]?.email as string | undefined;

  check("the leader account is found", Boolean(leaderEmail), leaderEmail ?? "not found");

  const leaderToken = leaderEmail ? await login(leaderEmail) : null;

  check("the leader signs in", Boolean(leaderToken));

  if (!leaderToken) {
    await pool.end();

    return;
  }

  const mine = await call("GET", "/rescue-dispatch/mine", { token: leaderToken });

  check(
    "the leader sees the assignment",
    mine.status === 200 && Boolean(mine.data?.active),
    mine.data?.active?.dispatchCode ?? `status ${mine.status}`
  );
  check(
    "the mission brief and the officer reached them",
    mine.data?.active?.missionNotes?.includes("ropes") &&
      Boolean(mine.data?.active?.dispatchedByName),
    `${mine.data?.active?.dispatchedByName ?? "?"}`
  );

  const jump = await call("POST", `/rescue-dispatch/dispatches/${roll.id}/status`, {
    token: leaderToken,
    body: { status: "COMPLETED" },
  });

  check(
    "jumping straight to COMPLETED is refused",
    jump.status === 409,
    `status ${jump.status}: ${jump.data?.message}`
  );

  for (const stage of ["ACCEPTED", "EN_ROUTE", "ARRIVED", "RESCUE_IN_PROGRESS", "COMPLETED"]) {
    const moved = await call("POST", `/rescue-dispatch/dispatches/${roll.id}/status`, {
      token: leaderToken,
      body: {
        status: stage,
        note: stage === "COMPLETED" ? undefined : `${stage} reached.`,
        peopleRescued: stage === "COMPLETED" ? 6 : undefined,
        peopleEvacuated: stage === "COMPLETED" ? 14 : undefined,
      },
    });

    check(
      `${stage} is accepted`,
      moved.status === 200 && moved.data?.dispatch?.status === stage,
      `status ${moved.status} / ${moved.data?.dispatch?.status ?? moved.data?.message}`
    );
  }

  console.log("\n7. the team is handed back and the trail is complete");
  check(
    "availability returns to AVAILABLE",
    (await availabilityOf(roll.teamId)) === "AVAILABLE",
    `availability ${await availabilityOf(roll.teamId)}`
  );

  const idle = await call("GET", "/rescue-dispatch/mine", { token: leaderToken });

  check("the leader board goes quiet", idle.status === 200 && !idle.data?.active);

  const operations = await call("GET", "/rescue-dispatch/dispatches?status=all", {
    token: officerToken,
  });
  const row = ((operations.data?.dispatches ?? []) as {
    dispatchCode: string;
    events: unknown[];
  }[]).find((item) => item.dispatchCode === roll.dispatchCode);

  check("the mission is in the officer's operations list", Boolean(row));
  check(
    "every stage left a trail row",
    Boolean(row) && row!.events.length >= 6,
    `${row ? row!.events.length : 0} events`
  );

  const detail = await call("GET", `/rescue-dispatch/incidents/${incident.reportId}`, {
    token: officerToken,
  });
  const outcome = (detail.data?.incident?.dispatches ?? [])[0] as
    | { status: string; peopleRescued?: number; peopleEvacuated?: number }
    | undefined;

  check(
    "the outcome numbers were recorded",
    outcome?.peopleRescued === 6 && outcome?.peopleEvacuated === 14,
    JSON.stringify(outcome)
  );

  console.log("\n8. accounts that do not own the mission are turned away");
  const otherRow = await pool.query(
    `SELECT u.email
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE t.id <> $1 AND t.operating_district = 'Colombo'
      LIMIT 1`,
    [roll.teamId]
  );
  const otherEmail = otherRow.rows[0]?.email as string | undefined;

  if (otherEmail) {
    const otherToken = await login(otherEmail);

    if (otherToken) {
      const intrusion = await call(
        "POST",
        `/rescue-dispatch/dispatches/${roll.id}/status`,
        { token: otherToken, body: { status: "RETURNING" } }
      );

      check(
        "another team's leader is refused",
        intrusion.status === 403,
        `status ${intrusion.status}: ${intrusion.data?.message}`
      );
    }
  }

  const citizen = await pool.query("SELECT email FROM users WHERE role = 'CITIZEN' LIMIT 1");
  const citizenEmail = citizen.rows[0]?.email as string | undefined;

  if (citizenEmail) {
    const citizenToken = await login(citizenEmail);

    if (citizenToken) {
      const blocked = await call("GET", "/rescue-dispatch/incidents", {
        token: citizenToken,
      });

      check(
        "a citizen cannot read incidents",
        blocked.status === 403 || blocked.status === 401,
        `status ${blocked.status}`
      );
    }
  }

  console.log("\n9. the district takes the incident onto its own desk");
  const acceptPath = `/rescue-dispatch/incidents/${incident.reportId}/accept`;

  const anonymous = await call("POST", acceptPath, { body: {} });

  check(
    "an anonymous acceptance is turned away",
    anonymous.status === 401 || anonymous.status === 403,
    `status ${anonymous.status}`
  );

  const tooLong = await call("POST", acceptPath, {
    token: officerToken,
    body: { note: "x".repeat(301) },
  });

  check(
    "a handover note over 300 characters is refused",
    tooLong.status === 400,
    `status ${tooLong.status}: ${tooLong.data?.message ?? ""}`
  );

  const accepted = await call("POST", acceptPath, {
    token: officerToken,
    body: {},
  });

  check(
    "the district can accept with no note at all",
    accepted.status === 200 && Boolean(accepted.data?.incident?.acceptedAt),
    `status ${accepted.status}: ${accepted.data?.message ?? ""}`
  );

  const firstAcceptedAt = accepted.data?.incident?.acceptedAt as string | undefined;

  check(
    "the acceptance records who took it on",
    Boolean(accepted.data?.incident?.acceptedByName),
    `${accepted.data?.incident?.acceptedByName}`
  );

  const corrected = await call("POST", acceptPath, {
    token: officerToken,
    body: { note: PROBE_HANDOVER },
  });

  check(
    "accepting again corrects the handover note",
    corrected.status === 200 && corrected.data?.incident?.handoverNote === PROBE_HANDOVER,
    `status ${corrected.status}: ${corrected.data?.incident?.handoverNote ?? ""}`
  );
  check(
    "the moment it was first taken on never moves",
    corrected.data?.incident?.acceptedAt === firstAcceptedAt,
    `${firstAcceptedAt} vs ${corrected.data?.incident?.acceptedAt}`
  );

  const dbAcceptance = await pool.query(
    `SELECT accepted_by, accepted_at, handover_note
       FROM district_incident_acceptance
      WHERE report_id = (SELECT id FROM hazard_reports WHERE report_id = $1) LIMIT 1`,
    [incident.reportId]
  );

  check(
    "the acceptance is stored as the district's own row",
    dbAcceptance.rowCount === 1 && Boolean(dbAcceptance.rows[0]?.accepted_by),
    `by ${dbAcceptance.rows[0]?.accepted_by ?? "nobody"}`
  );
  check(
    "verification was left exactly as the DMC officer set it",
    (
      await pool.query(
        `SELECT status FROM hazard_reports WHERE report_id = $1 LIMIT 1`,
        [incident.reportId]
      )
    ).rows[0]?.status === "VERIFIED"
  );

  const desk = await call("GET", "/rescue-dispatch/incidents", {
    token: officerToken,
  });
  const deskRow = ((desk.data?.incidents ?? []) as {
    reportId: string;
    dispatchCount: number;
    liveDispatchCount: number;
    acceptedAt?: string;
    handoverNote?: string;
  }[]).find((item) => item.reportId === incident.reportId);

  check(
    "the desk list shows the incident as taken on",
    deskRow?.acceptedAt === firstAcceptedAt && deskRow?.handoverNote === PROBE_HANDOVER,
    `acceptedAt ${deskRow?.acceptedAt}`
  );
  check(
    "the pipeline counts the finished mission and no live one",
    (deskRow?.dispatchCount ?? 0) >= 1 && (deskRow?.liveDispatchCount ?? 1) === 0,
    `total ${deskRow?.dispatchCount}, live ${deskRow?.liveDispatchCount}`
  );

  /* What the desk must never be able to do: take on something the DMC has not
     verified, or reach into another district. */
  const unverified = await pool.query(
    `SELECT report_id FROM hazard_reports
      WHERE status <> 'VERIFIED' AND location_district = 'Colombo'
      ORDER BY created_at ASC LIMIT 1`
  );
  const unverifiedCode = unverified.rows[0]?.report_id as string | undefined;

  if (unverifiedCode) {
    const early = await call(
      "POST",
      `/rescue-dispatch/incidents/${unverifiedCode}/accept`,
      { token: officerToken, body: {} }
    );

    check(
      "a report that is not verified is no incident to accept",
      early.status === 404,
      `status ${early.status}: ${early.data?.message ?? ""} (${unverifiedCode})`
    );
  } else {
    console.log("  (no unverified report in Colombo — that refusal was not probed)");
  }

  const elsewhere = await pool.query(
    `SELECT report_id, location_district FROM hazard_reports
      WHERE status = 'VERIFIED' AND location_district <> 'Colombo'
      ORDER BY created_at DESC LIMIT 1`
  );
  const outside = elsewhere.rows[0];

  if (outside) {
    const intrusion = await call(
      "POST",
      `/rescue-dispatch/incidents/${outside.report_id}/accept`,
      { token: officerToken, body: { note: PROBE_HANDOVER } }
    );

    check(
      "another district's incident cannot be taken on",
      intrusion.status === 403,
      `status ${intrusion.status}: ${intrusion.data?.message ?? ""} (${outside.report_id}/${outside.location_district})`
    );
  } else {
    console.log("  (no verified incident outside Colombo — that refusal was not probed)");
  }

  console.log("\n10. the stage list comes from the server");
  const stages = await call("GET", "/rescue-dispatch/stages", { token: officerToken });

  check(
    "stages are published",
    stages.status === 200 && Array.isArray(stages.data?.stages) && stages.data.stages.length === 9,
    `${stages.data?.stages?.length ?? 0} stages`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  await cleanProbeMissions("end");
  await pool.end();

  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error("crashed:", error);
  await pool.end();
  process.exitCode = 1;
});
