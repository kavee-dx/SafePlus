import bcrypt from "bcrypt";
import pool from "./config/db";

async function main() {
  const passwordHash = await bcrypt.hash("District@123", 12);

  const userResult = await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, phone_number, role, status, district, verified_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (email) DO UPDATE
       SET status = 'ACTIVE', role = 'DISTRICT_OFFICER', district = $7
     RETURNING id`,
    [
      "Kaveesha Test Officer",
      "district.test@safeplus.lk",
      passwordHash,
      "+94771234567",
      "DISTRICT_OFFICER",
      "ACTIVE",
      "Colombo",
    ]
  );

  const userId = userResult.rows[0].id;

  await pool.query(
    `INSERT INTO district_officers (id, user_id, officer_id, assigned_district, divisional_secretariats, clearance_level, duty_phone_number)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
       SET assigned_district = $3, divisional_secretariats = $4, clearance_level = $5, duty_phone_number = $6`,
    [
      userId,
      "DO-TEST-001",
      "Colombo",
      "Colombo,Thimbirigasyaya,Dehiwala",
      "Full District Authority",
      "+94771234567",
    ]
  );

  const check = await pool.query(
    `SELECT u.email, u.role, u.status, u.district, o.officer_id, o.clearance_level
     FROM users u JOIN district_officers o ON o.user_id = u.id
     WHERE u.email = $1`,
    ["district.test@safeplus.lk"]
  );
  console.log(JSON.stringify(check.rows[0], null, 2));

  const reports = [
    {
      reportId: "RPT-TEST-001",
      hazard: "FLOOD",
      severity: "HIGH",
      district: "Colombo",
      description:
        "Kirillawala canal is overflowing onto the main road. Water level rising fast, several houses at risk.",
      affected: 120,
    },
    {
      reportId: "RPT-TEST-002",
      hazard: "LANDSLIDE_RISK",
      severity: "CRITICAL",
      district: "Colombo",
      description:
        "Cracks appearing on the slope above the housing scheme at Padukka after continuous rain.",
      affected: 45,
    },
    {
      reportId: "RPT-TEST-003",
      hazard: "FLOOD",
      severity: "CRITICAL",
      district: "Galle",
      description:
        "Test report for another district — must never appear in the Colombo officer queue.",
      affected: 500,
    },
  ];

  for (const report of reports) {
    await pool.query(
      `INSERT INTO hazard_reports (report_id, hazard_type, severity_level, location_district, location_lat, location_lng, description, affected_population, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_VERIFICATION')
       ON CONFLICT (report_id) DO NOTHING`,
      [
        report.reportId,
        report.hazard,
        report.severity,
        report.district,
        6.9271,
        79.8612,
        report.description,
        report.affected,
      ]
    );
  }
  console.log("Seeded 3 test hazard reports (2 Colombo, 1 Galle).");

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
