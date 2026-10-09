/**
 * Rescue demo data seeder.
 *
 * Builds the drill structure requested for the district review screens:
 *   2 districts x 5 organizations x 3 disaster types x 6 teams = 180 teams.
 *
 * Organizations and teams are created through the real registration endpoints
 * (POST /api/registrations/rescue-organization and
 * POST /api/registrations/rescue-team-organization) so every payload passes the
 * same validators, verified-organization checks and profile inserts as a human
 * submission would. Only the *approval* step is written straight to the
 * database, because sending 190 approval emails would take minutes and flood
 * the inbox; the columns it touches are the same ones the approve endpoint sets.
 *
 * Usage:
 *   npx tsx kaveesha-seedRescueDemo.ts            # seed
 *   npx tsx kaveesha-seedRescueDemo.ts --reset    # delete everything it created
 *   SEED_API_BASE=http://localhost:5000/api       # override the API address
 */
import pool from "./config/db";

/* ------------------------------------------------------------------ config */

const BASE = process.env.SEED_API_BASE ?? "http://localhost:5000/api";
const PASSWORD = "SafePlus@2026";
const REG_ID_PREFIX = "DEM-";
const NIC_BLOCK = 198510000000; // 12-digit NICs, 198510000001 upwards
const TEAMS_PER_DISASTER = 6;
const BATCH_SIZE = 4;
// Own domains, so --reset only removes what this script created and never
// touches the organizations and leaders registered by hand through the portal.
const ORG_EMAIL_SUFFIX = "@seedrescue.lk";
const LEADER_EMAIL_SUFFIX = "@seedteam.lk";

interface DisasterFamily {
  word: string;
  teamType: string;
  designation: string;
  capabilities: string;
  equipment: string;
}

const FAMILIES: DisasterFamily[] = [
  {
    word: "Flood",
    teamType: "Flood Rescue",
    designation: "Flood Rescue Lead",
    capabilities: "Flood Rescue,Water Rescue,Evacuation,Night Operations",
    equipment: "Rescue Boat,Life Jackets,Ropes,First Aid Kit,Radio",
  },
  {
    word: "Fire",
    teamType: "Fire & Rescue",
    designation: "Fire Response Lead",
    capabilities: "Fire Rescue,Search & Rescue,Medical / First Aid,Night Operations",
    equipment: "Rescue Vehicle,First Aid Kit,Ropes,Search Lights,Radio",
  },
  {
    word: "Landslide",
    teamType: "Landslide Rescue",
    designation: "Landslide Rescue Lead",
    capabilities: "Landslide Rescue,Search & Rescue,Evacuation,Medical / First Aid",
    equipment: "Ropes,First Aid Kit,Search Lights,Drone,Radio",
  },
];

interface OrganizationSpec {
  short: string;
  name: string;
  type: string;
  code: string; // registration id suffix, e.g. DEM-CMB-01
  address: string;
  phone: string;
  adminName: string;
  adminDesignation: string;
}

interface DistrictSpec {
  district: string;
  code: string;
  center: [number, number];
  bases: string[];
  organizations: OrganizationSpec[];
}

const DISTRICTS: DistrictSpec[] = [
  {
    district: "Colombo",
    code: "CMB",
    center: [6.9271, 79.8612],
    bases: [
      "Kelaniya boat bay",
      "Wellawatte canal bank",
      "Diyatha Uyana, Battaramulla",
      "Hanwella bridge",
      "Kolonnawa urban settlement",
      "Bench Town, Wellawatte",
      "Attidiya wetland edge",
      "Maharagama main canal",
      "Pamankada junction",
      "Ward Place flood spot",
      "Boralesgamuwa drain",
      "Mulleriyawa awaysa",
    ],
    organizations: [
      {
        short: "CWSC",
        name: "Colombo Water Safety Corps",
        type: "NGO",
        code: "01",
        address: "24 Dial Park Road, Cinnamon Gardens, Colombo 05",
        phone: "0112670101",
        adminName: "Roshan de Silva",
        adminDesignation: "Operations Director",
      },
      {
        short: "WURA",
        name: "Western Urban Rescue Alliance",
        type: "Private Emergency Service",
        code: "02",
        address: "115 Dharmapala Mawatha, Colombo 03",
        phone: "0112670102",
        adminName: "Vishma Kokkalaya",
        adminDesignation: "Alliance Coordinator",
      },
      {
        short: "HFRC",
        name: "Hanwella Flood Response Collective",
        type: "Community Organization",
        code: "03",
        address: "83 Main Street, Hanwella, Colombo 11",
        phone: "0112670103",
        adminName: "Asela Pushpakumara",
        adminDesignation: "Collective Chairman",
      },
      {
        short: "LFES",
        name: "Lankavidu Fire Emergency Service",
        type: "Fire & Rescue",
        code: "04",
        address: "17 Kirulapone Avenue, Colombo 05",
        phone: "0112670104",
        adminName: "Lahiru Bandara",
        adminDesignation: "Chief Fire Officer",
      },
      {
        short: "KVET",
        name: "Kelani Valley Emergency Trust",
        type: "NGO",
        code: "05",
        address: "45 Kelaniya Bridge Road, Kelaniya, Colombo",
        phone: "0112670105",
        adminName: "Dilhani Herdath",
        adminDesignation: "Trust Secretary",
      },
    ],
  },
  {
    district: "Gampaha",
    code: "GAP",
    center: [7.0917, 79.9842],
    bases: [
      "Negombo fish market",
      "Wattala junction",
      "Munmala canal bank",
      "Kadawatha town center",
      "Katunayake Airport road",
      "Negombo lagoon beach",
      "Seeduwa Boppe junction",
      "Kiribathwala wetland",
      "Attandowa bridge",
      "Dompe rail siding",
      "Kirulapone tank",
      "Negombo boat harbor",
    ],
    organizations: [
      {
        short: "GDRV",
        name: "Gampaha District Rescue Volunteers",
        type: "Community Organization",
        code: "01",
        address: "67 Yakkala Road, Gampaha",
        phone: "0332670201",
        adminName: "Tharindu Samaraweera",
        adminDesignation: "Volunteer Chief",
      },
      {
        short: "NCES",
        name: "Negombo Coastal Emergency Service",
        type: "Private Emergency Service",
        code: "02",
        address: "12 Sea View Road, Negombo",
        phone: "0332670202",
        adminName: "Gehan Rathnayaka",
        adminDesignation: "Coastal Operations Manager",
      },
      {
        short: "WFAN",
        name: "Wattala Flood Action Network",
        type: "NGO",
        code: "03",
        address: "201 Katuwana Road, Wattala",
        phone: "0332670203",
        adminName: "Ishara Vidanalage",
        adminDesignation: "Network Director",
      },
      {
        short: "KHLU",
        name: "Kandapana Hills Landslide Response Unit",
        type: "Government Agency",
        code: "04",
        address: "9 Horana Road, Kiribathgoda",
        phone: "0332670204",
        adminName: "Nadeera Gunawardena",
        adminDesignation: "Unit Commander",
      },
      {
        short: "CREC",
        name: "Chilaw Rapid Emergency Corps",
        type: "Police / Emergency Service",
        code: "05",
        address: "34 Chandesiya Street, Chilaw",
        phone: "0332670205",
        adminName: "Sasiri Jayasuriya",
        adminDesignation: "Corps Commander",
      },
    ],
  },
];

const LEADER_FIRST_NAMES = [
  "Nimal",
  "Ranil",
  "Sunila",
  "Dinesh",
  "Mahesh",
  "Kumara",
  "Anura",
  "Shamika",
  "Priyantha",
  "Kamala",
  "Sanath",
  "Thiriyai",
  "Upul",
  "Chandani",
  "Deepika",
  "Roshan",
  "Vishma",
  "Asela",
  "Buddhika",
  "Charith",
];

const LEADER_LAST_NAMES = [
  "Perera",
  "Silva",
  "Jayawardene",
  "Bandara",
  "Fernando",
  "Karunaratne",
  "Dharmapala",
  "Jayasekara",
  "Wickramasinghe",
  "Amarasekara",
  "Dissanayaka",
  "Nissanka",
  "Alwis",
  "Gunawardena",
  "Rathnayaka",
  "Samaraweera",
  "Vidanalage",
  "Pushpakumara",
  "Herdath",
  "Kokkalaya",
];

/* ------------------------------------------------------------------ helpers */

let leaderCounter = 0;
let failures = 0;

function log(message: string): void {
  console.log(message);
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function leaderName(index: number): string {
  const first = LEADER_FIRST_NAMES[index % LEADER_FIRST_NAMES.length];
  const last = LEADER_LAST_NAMES[Math.floor(index / LEADER_FIRST_NAMES.length) % LEADER_LAST_NAMES.length];

  return `${first} ${last}`;
}

/**
 * A deterministic point a few hundred metres from the district centre, so the
 * 180 bases never stack on top of each other on the dispatch map.
 */
function basePoint(
  center: [number, number],
  orgIndex: number,
  familyIndex: number,
  teamIndex: number
): [number, number] {
  const lat =
    center[0] +
    (orgIndex - 2) * 0.016 +
    (familyIndex - 1) * 0.009 +
    (teamIndex - 2.5) * 0.0035;
  const lng =
    center[1] +
    (teamIndex - 2.5) * 0.013 +
    (orgIndex - 2) * 0.007 +
    (familyIndex - 1) * 0.004;

  return [round4(lat), round4(lng)];
}

async function post<T = any>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    errors?: Record<string, string>;
  };

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `${path} -> ${response.status} ${payload.message ?? ""} ${JSON.stringify(payload.errors ?? {})}`
    );
  }

  return payload;
}

async function runBatch<T>(
  items: T[],
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const slice = items.slice(index, index + BATCH_SIZE);

    await Promise.all(
      slice.map(async (item) => {
        try {
          await worker(item);
        } catch (error) {
          failures += 1;
          log(`  FAIL  ${(error as Error).message}`);
        }
      })
    );

    log(`  ...${Math.min(index + BATCH_SIZE, items.length)}/${items.length} submitted`);
  }
}

/* ------------------------------------------------------------------ payloads */

interface SeededOrg {
  userId: string;
  adminEmail: string;
  short: string;
  name: string;
  registrationId: string;
  district: string;
}

async function registerOrganization(
  spec: OrganizationSpec,
  districtSpec: DistrictSpec
): Promise<SeededOrg> {
  const registrationId = `${REG_ID_PREFIX}${districtSpec.code}-${spec.code}`;
  const adminEmail = `org${districtSpec.code.toLowerCase()}${spec.code}${ORG_EMAIL_SUFFIX}`;

  const result = await post<{ message: string; account: { id: string } }>(
    "/registrations/rescue-organization",
    {
      organizationName: spec.name,
      organizationType: spec.type,
      registrationNumber: registrationId,
      district: districtSpec.district,
      organizationAddress: spec.address,
      officialEmail: `office${registrationId.toLowerCase().replace(/[^a-z0-9]/g, "")}${ORG_EMAIL_SUFFIX}`,
      officialPhone: spec.phone,
      adminFullName: spec.adminName,
      adminDesignation: spec.adminDesignation,
      adminEmail,
      adminPhone: spec.phone,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }
  );

  return {
    userId: result.account.id,
    adminEmail,
    short: spec.short,
    name: spec.name,
    registrationId,
    district: districtSpec.district,
  };
}

interface TeamJob {
  organization: SeededOrg;
  payload: Record<string, string>;
  availability: string;
  label: string;
}

function buildTeamJobs(
  organization: SeededOrg,
  districtSpec: DistrictSpec,
  orgIndex: number
): TeamJob[] {
  const jobs: TeamJob[] = [];

  FAMILIES.forEach((family, familyIndex) => {
    for (let teamIndex = 0; teamIndex < TEAMS_PER_DISASTER; teamIndex += 1) {
      leaderCounter += 1;

      const number = leaderCounter;
      const [lat, lng] = basePoint(
        districtSpec.center,
        orgIndex,
        familyIndex,
        teamIndex
      );
      const base =
        districtSpec.bases[
          (orgIndex * 2 + familyIndex * TEAMS_PER_DISASTER + teamIndex) %
            districtSpec.bases.length
        ];
      // Four available, one on deployment, one standing down, so the
      // availability filters on the dashboards have something to show.
      const availability =
        teamIndex <= 3 ? "AVAILABLE" : teamIndex === 4 ? "ON_DEPLOYMENT" : "UNAVAILABLE";

      jobs.push({
        organization,
        availability,
        label: `${districtSpec.district} ${family.word} ${pad(number, 3)}`,
        payload: {
          leaderFullName: leaderName(number),
          nicNumber: String(NIC_BLOCK + number),
          leaderDesignation: family.designation,
          contactNumber: `077${pad(1000000 + number, 7)}`,
          email: `leader${pad(number, 3)}${LEADER_EMAIL_SUFFIX}`,
          password: PASSWORD,
          confirmPassword: PASSWORD,
          organizationName: organization.name,
          organizationRegistrationNumber: organization.registrationId,
          teamName: `${districtSpec.district} ${organization.short} ${family.word} Team ${pad(teamIndex + 1, 2)}`,
          teamType: family.teamType,
          teamSize: String(6 + (number % 11)),
          district: districtSpec.district,
          teamContactNumber: `076${pad(2000000 + number, 7)}`,
          capabilities: family.capabilities,
          equipment: family.equipment,
          baseLatitude: String(lat),
          baseLongitude: String(lng),
          baseLocationLabel: `${base}, ${districtSpec.district}`,
        },
      });
    }
  });

  return jobs;
}

/* ------------------------------------------------------------------ database */

async function assertClean(): Promise<void> {
  const existing = await pool.query(
    `SELECT count(*)::int AS teams
       FROM users
      WHERE email LIKE $1 OR email LIKE $2`,
    [`%${ORG_EMAIL_SUFFIX}`, `%${LEADER_EMAIL_SUFFIX}`]
  );

  if (existing.rows[0].teams > 0) {
    throw new Error(
      `${existing.rows[0].teams} demo accounts already exist. Run "npx tsx kaveesha-seedRescueDemo.ts --reset" first.`
    );
  }

  const nicClash = await pool.query(
    `SELECT count(*)::int AS n FROM users WHERE nic_number LIKE $1`,
    [`${NIC_BLOCK}`.slice(0, 8) + "%"]
  );

  if (nicClash.rows[0].n > 0) {
    throw new Error(
      "The demo NIC block is already in use by real accounts. Change NIC_BLOCK before seeding."
    );
  }
}

/**
 * Mirrors what the approve endpoints do (users.status / verified_at and the
 * review columns on team_leaders) without sending an email per team.
 */
async function activateAccounts(userIds: string[]): Promise<void> {
  await pool.query(
    `UPDATE users
        SET status = 'ACTIVE', verified_at = NOW(), rejection_reason = NULL
      WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
}

async function markTeamsReviewed(jobs: TeamJob[]): Promise<void> {
  const emails = jobs.map((job) => job.payload.email);
  const { rows } = await pool.query(
    `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
    [emails]
  );
  const idByEmail = new Map(rows.map((row) => [row.email as string, row.id as string]));
  const userIds: string[] = [];
  const states: string[] = [];
  const reviewers: string[] = [];

  for (const job of jobs) {
    const userId = idByEmail.get(job.payload.email);

    if (!userId) continue;

    userIds.push(userId);
    states.push(job.availability);
    reviewers.push(job.organization.userId);
  }

  await pool.query(
    `UPDATE team_leaders t
        SET availability = s.state,
            reviewed_at = NOW(),
            reviewed_by_user_id = s.reviewer
       FROM (SELECT unnest($1::uuid[]) AS user_id,
                    unnest($2::text[]) AS state,
                    unnest($3::uuid[]) AS reviewer) s
      WHERE t.user_id = s.user_id`,
    [userIds, states, reviewers]
  );
}

/* ------------------------------------------------------------------ checks */

async function report(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT o.district,
            o.organization_name,
            o.registration_number,
            COUNT(*) FILTER (WHERE t.team_type = 'Flood Rescue')     AS flood,
            COUNT(*) FILTER (WHERE t.team_type = 'Fire & Rescue')    AS fire,
            COUNT(*) FILTER (WHERE t.team_type = 'Landslide Rescue') AS landslide,
            COUNT(*)                                                 AS teams,
            COUNT(*) FILTER (WHERE t.availability = 'AVAILABLE')     AS available,
            COUNT(*) FILTER (WHERE t.availability = 'ON_DEPLOYMENT') AS deployed,
            COUNT(*) FILTER (WHERE u.status = 'ACTIVE')              AS verified
       FROM rescue_organizations o
       LEFT JOIN team_leaders t ON t.organization_registration_number = o.registration_number
       LEFT JOIN users u ON u.id = t.user_id
      WHERE o.registration_number LIKE $1
      GROUP BY o.district, o.organization_name, o.registration_number
      ORDER BY o.district, o.registration_number`,
    [`${REG_ID_PREFIX}%`]
  );

  log("\nDISTRICT  ORGANIZATION                         REG ID      FLOOD FIRE LAND  TEAMS  AVAIL  DEPLOYED  VERIFIED");
  log("-".repeat(112));

  let broken = 0;

  for (const row of rows) {
    const complete =
      Number(row.flood) === TEAMS_PER_DISASTER &&
      Number(row.fire) === TEAMS_PER_DISASTER &&
      Number(row.landslide) === TEAMS_PER_DISASTER &&
      Number(row.teams) === TEAMS_PER_DISASTER * FAMILIES.length &&
      Number(row.verified) === Number(row.teams);

    if (!complete) broken += 1;

    log(
      `${String(row.district).padEnd(9)} ${String(row.organization_name).padEnd(36)} ${String(
        row.registration_number
      ).padEnd(11)} ${String(row.flood).padStart(5)} ${String(row.fire).padStart(5)} ${String(
        row.landslide
      ).padStart(5)} ${String(row.teams).padStart(6)} ${String(row.available).padStart(6)} ${String(
        row.deployed
      ).padStart(9)} ${String(row.verified).padStart(9)}  ${complete ? "OK" : "CHECK"}`
    );
  }

  const totals = await pool.query(
    `SELECT COUNT(*)::int AS teams,
            COUNT(DISTINCT o.id)::int AS organizations,
            COUNT(*) FILTER (WHERE t.availability = 'AVAILABLE')::int AS available,
            COUNT(*) FILTER (WHERE t.availability = 'ON_DEPLOYMENT')::int AS deployed,
            COUNT(*) FILTER (WHERE t.availability = 'UNAVAILABLE')::int AS standing_down,
            COUNT(*) FILTER (WHERE t.base_latitude IS NOT NULL)::int AS mapped
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
       JOIN rescue_organizations o ON o.registration_number = t.organization_registration_number
      WHERE u.email LIKE $1 AND o.registration_number LIKE $2`,
    [`%${LEADER_EMAIL_SUFFIX}`, `${REG_ID_PREFIX}%`]
  );

  log("-".repeat(112));
  log(
    `TOTALS      organizations=${totals.rows[0].organizations} teams=${totals.rows[0].teams} ` +
      `available=${totals.rows[0].available} on-deployment=${totals.rows[0].deployed} ` +
      `standing-down=${totals.rows[0].standing_down} with-base-point=${totals.rows[0].mapped}`
  );

  const officers = await pool.query(
    `SELECT u.district, COUNT(*)::int AS teams
       FROM team_leaders t
       JOIN users u ON u.id = t.user_id
      WHERE u.email LIKE $1
      GROUP BY u.district
      ORDER BY u.district`,
    [`%${LEADER_EMAIL_SUFFIX}`]
  );

  log(`BY DISTRICT  ${officers.rows.map((r) => `${r.district}=${r.teams}`).join("  ")}`);

  if (broken > 0) {
    throw new Error(`${broken} organization(s) did not reach ${TEAMS_PER_DISASTER} teams per disaster type.`);
  }
}

/* ------------------------------------------------------------------ reset */

async function reset(): Promise<void> {
  const teams = await pool.query(
    `DELETE FROM team_leaders
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)
      RETURNING user_id`,
    [`%${LEADER_EMAIL_SUFFIX}`]
  );
  const orgs = await pool.query(
    `DELETE FROM rescue_organizations WHERE registration_number LIKE $1 RETURNING id`,
    [`${REG_ID_PREFIX}%`]
  );
  const users = await pool.query(
    `DELETE FROM users
      WHERE email LIKE $1 OR email LIKE $2
      RETURNING id`,
    [`%${LEADER_EMAIL_SUFFIX}`, `%${ORG_EMAIL_SUFFIX}`]
  );

  log(
    `Removed ${teams.rowCount} team profiles, ${orgs.rowCount} organizations, ${users.rowCount} accounts.`
  );
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--reset")) {
    await reset();
    await pool.end();

    return;
  }

  const health = await fetch(`${BASE}/health`).catch(() => null);

  if (!health || health.status >= 500) {
    throw new Error(`The API is not answering on ${BASE}. Start it with "npm run dev" first.`);
  }

  await assertClean();

  /* 1. organizations */
  const organizations: { seeded: SeededOrg; districtSpec: DistrictSpec; orgIndex: number }[] = [];

  for (const districtSpec of DISTRICTS) {
    for (let index = 0; index < districtSpec.organizations.length; index += 1) {
      const seeded = await registerOrganization(districtSpec.organizations[index], districtSpec);

      organizations.push({ seeded, districtSpec, orgIndex: index });
      log(`ORG  ${seeded.registrationId}  ${seeded.name}  (${seeded.district})`);
    }
  }

  // Super Admin approval equivalent: the org owners become ACTIVE, which is
  // what puts their organization into the verified list team leaders pick from.
  await activateAccounts(organizations.map((entry) => entry.seeded.userId));
  log(`\n${organizations.length} organizations registered and verified.\n`);

  /* 2. teams */
  const jobs: TeamJob[] = [];

  organizations.forEach((entry) => {
    buildTeamJobs(entry.seeded, entry.districtSpec, entry.orgIndex).forEach((job) =>
      jobs.push(job)
    );
  });

  log(`Registering ${jobs.length} rescue teams (${FAMILIES.length} disaster types x ${TEAMS_PER_DISASTER} teams per organization)...`);

  await runBatch(jobs, async (job) => {
    await post("/registrations/rescue-team-organization", job.payload);
  });

  if (failures > 0) {
    throw new Error(`${failures} team registration(s) failed - fix them before verifying the dashboards.`);
  }

  const leaderIds = await pool.query(
    `SELECT id FROM users WHERE email LIKE $1`,
    [`%${LEADER_EMAIL_SUFFIX}`]
  );

  await activateAccounts(leaderIds.rows.map((row) => row.id as string));
  await markTeamsReviewed(jobs);

  log(`\n${jobs.length} rescue teams registered, verified and given an availability state.`);

  await report();

  log(
    `\nSign in with:\n` +
      `  organization admin   ${organizations.map((e) => e.seeded.adminEmail).slice(0, 2).join(", ")} ...   password ${PASSWORD}\n` +
      `  team leader          leader001${LEADER_EMAIL_SUFFIX} ... leader${pad(leaderCounter, 3)}${LEADER_EMAIL_SUFFIX}   password ${PASSWORD}`
  );

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
