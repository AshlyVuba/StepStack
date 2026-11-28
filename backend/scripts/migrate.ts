import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: url });
let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query("SELECT pg_advisory_lock(hashtext($1))", ["stepstack:schema-migrations"]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  for (const file of readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(join("migrations", file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM schema_migrations WHERE name = $1", [file]);
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file}`);
      console.log("already applied", file);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
      await client.query("COMMIT");
      console.log("applied", file);
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `Migration failed and rollback also failed: ${file}`);
      }
      throw error;
    }
  }
} finally {
  if (client) {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["stepstack:schema-migrations"]);
    } finally {
      client.release();
    }
  }
  await pool.end();
}
