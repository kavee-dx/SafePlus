import bcrypt from "bcrypt";

import pool from "./config/db";

/* ------------------------------------------------------------------ *
 * Demo shelters (UC: Shelter Coordination).
 *
 * The officer needs real rows to allocate against the moment the app starts,
 * and the end-to-end story only reads well if there is already a Shelter Manager
 * who can confirm an arrival. Everything here is idempotent — shelter_code and
 * the manager's email are the natural keys — so it is safe to re-run.
 * ------------------------------------------------------------------ */

interface SeedShelter {
  code: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  facilities: string[];
}

// A spread across Colombo so the "nearest suitable" recommendation has choices,
// plus two in Galle so a cross-district view is not empty either.
const SHELTERS: SeedShelter[] = [
  {
    code: "SH-CBM-01",
    name: "Bandaranaike Hall",
    district: "Colombo",
    address: "Independence Square, Colombo 07",
    latitude: 6.9021,
    longitude: 79.8686,
    capacity: 400,
    facilities: ["WC", "Drinking Water", "Generator", "Medical Post"],
  },
  {
    code: "SH-CBM-02",
    name: "Kirulapone School",
    district: "Colombo",
    address: "Rosme Place, Colombo 05",
    latitude: 6.9012,
    longitude: 79.8565,
    capacity: 180,
    facilities: ["WC", "Drinking Water"],
  },
  {
    code: "SH-CBM-03",
    name: "Dehiwala Community Centre",
    district: "Colombo",
    address: "Mercedes Road, Dehiwala",
    latitude: 6.851,
    longitude: 79.8812,
    capacity: 250,
    facilities: ["WC", "Drinking Water", "Baby Care"],
  },
  {
    code: "SH-CBM-04",
    name: "Maharagama Sports Hall",
    district: "Colombo",
    address: "Sri Siddhartha Mawatha, Maharagama",
    latitude: 6.9496,
    longitude: 79.9268,
    capacity: 120,
    facilities: ["WC"],
  },
  {
    code: "SH-GAL-01",
    name: "Galle Town Hall",
    district: "Galle",
    address: "Cool Street, Galle Fort",
    latitude: 5.983,
    longitude: 80.27,
    capacity: 300,
    facilities: ["WC", "Drinking Water", "Generator"],
  },
  {
    code: "SH-GAL-02",
    name: "Unawatuna School Hall",
    district: "Galle",
    address: "Beach Road, Unawatuna",
    latitude: 5.9206,
    longitude: 80.2546,
    capacity: 150,
    facilities: ["WC", "Drinking Water"],
  },
];

const MANAGER = {
  fullName: "Kaveesha Shelter Manager",
  email: "shelter.test@safeplus.lk",
  password: "SafePlus@2026",
  phone: "+94775551234",
  designation: "Shelter In-Charge",
  district: "Colombo",
  // Covers every Colombo shelter, so whichever one the "nearest with room"
  // recommendation picks, the same demo manager can confirm the arrival.
  shelterCodes: ["SH-CBM-01", "SH-CBM-02", "SH-CBM-03", "SH-CBM-04"],
};

async function upsertShelter(shelter: SeedShelter): Promise<string> {
  const result = await pool.query(
    `INSERT INTO shelters (
        shelter_code, name, district, address, latitude, longitude, max_capacity, facilities
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (shelter_code) DO UPDATE
       SET name = EXCLUDED.name,
           district = EXCLUDED.district,
           address = EXCLUDED.address,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           max_capacity = EXCLUDED.max_capacity,
           facilities = EXCLUDED.facilities,
           updated_at = NOW()
     RETURNING id`,
    [
      shelter.code,
      shelter.name,
      shelter.district,
      shelter.address,
      shelter.latitude,
      shelter.longitude,
      shelter.capacity,
      JSON.stringify(shelter.facilities),
    ]
  );

  return result.rows[0].id as string;
}

async function seedManager(shelterIdByCode: Map<string, string>): Promise<void> {
  const passwordHash = await bcrypt.hash(MANAGER.password, 12);

  const userResult = await pool.query(
    `INSERT INTO users (
        id, full_name, email, password_hash, phone_number, district, role, status
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'SHELTER_MANAGER', 'ACTIVE')
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone_number = EXCLUDED.phone_number,
           district = EXCLUDED.district,
           role = 'SHELTER_MANAGER',
           status = 'ACTIVE'
     RETURNING id`,
    [
      MANAGER.fullName,
      MANAGER.email,
      passwordHash,
      MANAGER.phone,
      MANAGER.district,
    ]
  );

  const userId = userResult.rows[0].id as string;

  const managerResult = await pool.query(
    `INSERT INTO shelter_managers (
        user_id, full_name, phone_number, designation, district, status
     )
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
     ON CONFLICT (user_id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone_number = EXCLUDED.phone_number,
           designation = EXCLUDED.designation,
           district = EXCLUDED.district,
           status = 'ACTIVE',
           updated_at = NOW()
     RETURNING id`,
    [
      userId,
      MANAGER.fullName,
      MANAGER.phone,
      MANAGER.designation,
      MANAGER.district,
    ]
  );

  const managerId = managerResult.rows[0].id as string;

  for (const code of MANAGER.shelterCodes) {
    const shelterId = shelterIdByCode.get(code);

    if (!shelterId) continue;

    await pool.query(
      `INSERT INTO shelter_manager_assignments (manager_id, shelter_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [managerId, shelterId]
    );
  }
}

async function main(): Promise<void> {
  const shelterIdByCode = new Map<string, string>();

  for (const shelter of SHELTERS) {
    shelterIdByCode.set(shelter.code, await upsertShelter(shelter));
  }

  await seedManager(shelterIdByCode);

  console.log(`Seeded ${SHELTERS.length} shelters across Colombo and Galle.`);
  console.log(
    `Seeded shelter manager: ${MANAGER.email} / ${MANAGER.password} (covers ${MANAGER.district}).`
  );

  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
