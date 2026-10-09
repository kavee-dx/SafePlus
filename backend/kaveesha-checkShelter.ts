/* ------------------------------------------------------------------ *
 * Temporary end-to-end check for Shelter Coordination.
 *
 * It drives the service layer directly (no HTTP server needed) against the live
 * database, and proves the things that actually matter: the officer registers a
 * shelter and a manager; a group is reserved without moving occupancy; a second
 * booking that would overfill is refused; occupancy rises ONLY when the manager
 * confirms arrival, and only by the count that arrived; walk-ins and departures
 * adjust it; and the citizen-facing band falls straight out of the same numbers.
 * Every row it writes it removes again, so it is safe to re-run.
 * ------------------------------------------------------------------ */

import pool from "./config/db";
import type { OfficerContext } from "./services/kaveesha-dispatchService";
import {
  allocateGroup,
  confirmArrival,
  createGroup,
  createShelterManager,
  nearbyShelters,
  recommendShelters,
  recordDeparture,
  recordWalkIn,
  registerShelter,
  resolveManagerProfile,
} from "./services/kaveesha-shelterService";

const OFFICER_EMAIL = "district.test@safeplus.lk";
const SHELTER_MANAGER_PASSWORD = "SafePlus@2026";

// Unique enough per run that a crashed earlier run's residue never confuses us.
const STAMP = Date.now().toString(36).toUpperCase();
const PROBE_NAME = `ZZ Probe Shelter ${STAMP}`;
const PROBE_MANAGER_EMAIL = `probe.sm.${STAMP}@safeplus.lk`;

// A point in Colombo; the probe shelter is placed a couple of km from here.
const ORIGIN = { latitude: 6.9, longitude: 79.86 };

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

async function expectThrow(label: string, work: Promise<unknown>): Promise<void> {
  try {
    await work;
    check(label, false, "expected an error but it succeeded");
  } catch (error: unknown) {
    check(label, true, (error as Error)?.message?.slice(0, 70) ?? "threw");
  }
}

async function loadOfficerContext(): Promise<OfficerContext> {
  const result = await pool.query(
    `SELECT u.id, u.full_name, o.assigned_district
       FROM users u
       JOIN district_officers o ON o.user_id = u.id
      WHERE u.email = $1
      LIMIT 1`,
    [OFFICER_EMAIL]
  );

  if (!result.rows[0]) {
    throw new Error(
      `Officer ${OFFICER_EMAIL} not found — run kaveesha-seedDistrictOfficer.ts first.`
    );
  }

  const row = result.rows[0] as {
    id: string;
    full_name: string;
    assigned_district: string;
  };

  return {
    userId: row.id,
    role: "DISTRICT_OFFICER",
    fullName: row.full_name,
    district: row.assigned_district,
  };
}

async function cleanup(context: OfficerContext | null): Promise<void> {
  // Remove in dependency order. Allocations/rows reference the group, the group
  // references nothing we created, and the manager is found by its probe email.
  const shelter = await pool.query(
    "SELECT id FROM shelters WHERE name = $1",
    [PROBE_NAME]
  );
  const shelterId = shelter.rows[0]?.id as string | undefined;

  const manager = await pool.query(
    `SELECT m.id, m.user_id FROM shelter_managers m
       JOIN users u ON u.id = m.user_id
      WHERE u.email = $1`,
    [PROBE_MANAGER_EMAIL]
  );
  const managerId = manager.rows[0]?.id as string | undefined;
  const managerUserId = manager.rows[0]?.user_id as string | undefined;

  const groups = await pool.query(
    "SELECT id FROM evacuee_groups WHERE district = $1",
    [context?.district ?? "Colombo"]
  );

  // Only the probe's own groups (those tied to the probe shelter) are removed.
  const probeGroupIds: string[] = [];

  for (const g of groups.rows as { id: string }[]) {
    const linked = await pool.query(
      "SELECT 1 FROM shelter_allocations WHERE group_id = $1 AND shelter_id = $2 LIMIT 1",
      [g.id, shelterId ?? "00000000-0000-0000-0000-000000000000"]
    );

    if ((linked.rowCount ?? 0) > 0 || shelterId) {
      const walkin = await pool.query(
        `SELECT 1 FROM shelter_allocations a
           JOIN shelters s ON s.id = a.shelter_id
          WHERE a.group_id = $1 AND s.name = $2 LIMIT 1`,
        [g.id, PROBE_NAME]
      );

      if ((walkin.rowCount ?? 0) > 0) probeGroupIds.push(g.id);
    }
  }

  if (probeGroupIds.length > 0) {
    await pool.query(
      "DELETE FROM shelter_events WHERE group_id = ANY($1::uuid[])",
      [probeGroupIds]
    );
    await pool.query(
      "DELETE FROM shelter_allocations WHERE group_id = ANY($1::uuid[])",
      [probeGroupIds]
    );
    await pool.query("DELETE FROM evacuee_groups WHERE id = ANY($1::uuid[])", [
      probeGroupIds,
    ]);
  }

  if (shelterId) {
    await pool.query("DELETE FROM shelter_events WHERE shelter_id = $1", [shelterId]);
    await pool.query(
      "DELETE FROM shelter_manager_assignments WHERE shelter_id = $1",
      [shelterId]
    );
    await pool.query("DELETE FROM shelters WHERE id = $1", [shelterId]);
  }

  if (managerId) {
    await pool.query("DELETE FROM shelter_manager_assignments WHERE manager_id = $1", [
      managerId,
    ]);
    await pool.query("DELETE FROM shelter_managers WHERE id = $1", [managerId]);
  }

  if (managerUserId) {
    await pool.query("DELETE FROM users WHERE id = $1", [managerUserId]);
  }
}

async function main(): Promise<void> {
  let context: OfficerContext | null = null;

  try {
    context = await loadOfficerContext();
    console.log(`Officer context: ${context.fullName} / ${context.district} District\n`);

    // 1. The officer registers a small shelter to test against.
    const shelter = await registerShelter(context, {
      name: PROBE_NAME,
      address: "Probe Lane, Colombo",
      latitude: ORIGIN.latitude + 0.01,
      longitude: ORIGIN.longitude + 0.01,
      maxCapacity: 50,
      facilities: ["WC", "Probe"],
    });

    check("shelter registered with capacity", shelter.maxCapacity === 50, shelter.shelterCode);
    check("shelter starts empty", shelter.confirmedOccupancy === 0);
    check(
      "remaining equals capacity when fresh",
      shelter.remainingAllocatable === 50
    );

    // 2. The officer creates a Shelter Manager and assigns this shelter.
    const manager = await createShelterManager(context, {
      fullName: "Probe Shelter Manager",
      email: PROBE_MANAGER_EMAIL,
      password: SHELTER_MANAGER_PASSWORD,
      district: context.district ?? "Colombo",
      shelterIds: [shelter.id],
    });

    check("manager created ACTIVE", manager.status === "ACTIVE", manager.email);
    check(
      "manager is assigned the probe shelter",
      manager.shelterIds.includes(shelter.id)
    );

    // The manager profile resolves from their own login id.
    const profile = await resolveManagerProfile(manager.userId);

    check(
      "manager can resolve their own assignment",
      profile.shelterIds.includes(shelter.id)
    );

    // 3. Recommendation from a point just away should offer the probe shelter.
    const recommendation = await recommendShelters({
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      people: 20,
      district: context.district ?? undefined,
    });

    check(
      "recommendation covers the whole group (no shortfall)",
      recommendation.complete && recommendation.unmet === 0
    );
    check(
      "recommendation lists at least one shelter",
      recommendation.plan.length >= 1,
      `top: ${recommendation.plan[0]?.name ?? "none"}`
    );

    // 4. An officer-registered group, then allocate it — reserves, occupancy stays 0.
    const group = await createGroup(context, {
      peopleCount: 20,
      district: context.district ?? "Colombo",
    });

    check("group created awaiting shelter", group.status === "AWAITING_SHELTER");

    const allocated = await allocateGroup(context, group.id, [
      { shelterId: shelter.id, count: 20 },
    ]);

    check("group marked allocated", allocated.status === "ALLOCATED");
    check("one allocation line recorded", allocated.allocations.length === 1);

    const afterReserve = await nearbyShelters({
      ...ORIGIN,
      district: context.district ?? undefined,
    });
    const probeView = afterReserve.find((s) => s.id === shelter.id);

    check(
      "reservation does not move confirmed occupancy",
      probeView?.confirmedOccupancy === 0,
      `occupancy=${probeView?.confirmedOccupancy}`
    );
    check(
      "reservation shows as pending arrivals",
      probeView?.pendingArrivals === 20,
      `pending=${probeView?.pendingArrivals}`
    );
    check(
      "remaining allocatable shrank by the reservation",
      probeView?.remainingAllocatable === 30,
      `remaining=${probeView?.remainingAllocatable}`
    );

    // 5. Double-booking refused: another group cannot take the 30+ reserved beds.
    await expectThrow(
      "over-allocation beyond free beds is refused",
      allocateGroup(context, group.id, [{ shelterId: shelter.id, count: 60 }])
    );

    // 6. The manager confirms only 15 of the 20 arrived. Occupancy rises by 15.
    const allocationId = allocated.allocations[0].id;
    const confirmed = await confirmArrival(
      manager.userId,
      allocationId,
      15,
      "Five turned back to a relative's house."
    );

    check("arrival confirmation raises occupancy by arrived count", confirmed.shelter.confirmedOccupancy === 15, `occupancy=${confirmed.shelter.confirmedOccupancy}`);
    check("allocation now CONFIRMED", confirmed.group.allocations[0].status === "CONFIRMED");
    check(
      "group shows PARTIAL (fewer arrived than allocated)",
      confirmed.group.status === "PARTIAL",
      confirmed.group.status
    );
    check(
      "pending drained after confirmation",
      confirmed.shelter.pendingArrivals === 0,
      `pending=${confirmed.shelter.pendingArrivals}`
    );

    // 7. A walk-in adds to occupancy directly (no pending stage).
    const walkInResult = await recordWalkIn(manager.userId, shelter.id, 5);

    check("walk-in lifts occupancy to 20", walkInResult.shelter.confirmedOccupancy === 20, `occupancy=${walkInResult.shelter.confirmedOccupancy}`);
    check("walk-in group is already ARRIVED", walkInResult.group.status === "ARRIVED");

    // 8. A departure reduces it and can never go below zero (SQL floors it).
    const afterDepart = await recordDeparture(
      manager.userId,
      shelter.id,
      7,
      "Resettled with family."
    );

    check("departure reduces occupancy to 13", afterDepart.confirmedOccupancy === 13, `occupancy=${afterDepart.confirmedOccupancy}`);

    const floored = await recordDeparture(manager.userId, shelter.id, 999);

    check("departure is floored at zero", floored.confirmedOccupancy === 0, `occupancy=${floored.confirmedOccupancy}`);

    // 9. A manager cannot act on a shelter they are not assigned.
    await expectThrow(
      "unassigned shelter is refused for a manager",
      recordWalkIn(manager.userId, "00000000-0000-0000-0000-000000000000", 2)
    );

    // 10. The citizen band falls straight out of the live numbers.
    const fresh = await registerShelter(context, {
      name: `${PROBE_NAME} B`,
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      maxCapacity: 10,
    });

    const citizenView = await nearbyShelters({ ...ORIGIN });
    const bandsOk = citizenView.every((s) =>
      ["AVAILABLE", "LIMITED", "FULL"].includes(s.status)
    );

    check("citizen nearby always carries a status band", bandsOk, `${citizenView.length} shelters`);

    // A shelter whose whole capacity is reserved reads FULL to the citizen too.
    const freshGroup = await createGroup(context, { peopleCount: 10 });

    await allocateGroup(context, freshGroup.id, [
      { shelterId: fresh.id, count: 10 },
    ]);
    const fullView = await nearbyShelters({ ...ORIGIN, district: context.district ?? undefined });
    const freshView = fullView.find((s) => s.id === fresh.id);

    check(
      "a fully-reserved shelter reads FULL",
      freshView?.status === "FULL",
      `status=${freshView?.status}`
    );

    // The second probe shelter and its group are removed by name/pattern too.
    await pool.query(
      `DELETE FROM shelter_allocations
        WHERE shelter_id IN (SELECT id FROM shelters WHERE name = $1)`,
      [`${PROBE_NAME} B`]
    );
    await pool.query(
      `DELETE FROM evacuee_groups WHERE id = $1`,
      [freshGroup.id]
    );
    await pool.query(
      `DELETE FROM shelter_events WHERE shelter_id IN (SELECT id FROM shelters WHERE name = $1)`,
      [`${PROBE_NAME} B`]
    );
    await pool.query("DELETE FROM shelters WHERE name = $1", [`${PROBE_NAME} B`]);

    console.log(
      `\n${passed} passed, ${failed} failed. Cleaning probe rows…`
    );
  } catch (error: unknown) {
    console.error("Harness aborted:", error);
    failed += 1;
  } finally {
    await cleanup(context);
    await pool.end();
  }

  process.exitCode = failed === 0 ? 0 : 1;
}

void main();
