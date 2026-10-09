import fs from "fs";
import path from "path";
import pool from "./config/db";

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsPath = path.join(process.cwd(), "migrations");

    // Explicit dependency order
    const migrationFiles = [
      "users.sql",
      "disasters.sql",
      "users_registration_columns.sql",
      "delivery_volunteers.sql",
      "delivery_volunteer_teams.sql",
      "relief_agencies.sql",
      "organization_admins.sql",
      "kaveesha-rescue_organizations.sql",
      "team_leaders.sql",
      "kaveesha-rescue_team_columns.sql",
      "district_officers.sql",
      "dmc_officers.sql",
      "hazard_reports.sql",
      "disaster_warnings.sql",
      "dmc_officer_clearance_pin.sql",
      "users_alert_targets.sql",
      "alert_sms_messages.sql",
      "amasha-super_admins.sql",
      "amasha-users_verification_columns.sql",
      "amasha-hazard_report_uc02.sql",
      "kaveesha-rescue_dispatch.sql",
      "kaveesha-district_incident_acceptance.sql",
      "kaveesha-incident_closure.sql"
    ];

    for (const file of migrationFiles) {
      const alreadyRun = await client.query(
        "SELECT 1 FROM schema_migrations WHERE migration_name = $1",
        [file]
      );

      if (alreadyRun.rowCount && alreadyRun.rowCount > 0) {
        console.log(`Skipping: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsPath, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`Running: ${file}`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
          [file]
        );

        await client.query("COMMIT");

        console.log(`Completed: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("All migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();