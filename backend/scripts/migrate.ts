import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: url });
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  await pool.query(readFileSync(join("migrations", f), "utf8"));
  console.log("applied", f);
}
await pool.end();
