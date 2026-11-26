import type pg from "pg";

export interface Skill { skill: string; level: "foundation" | "intermediate" | "advanced"; evidence?: string }

export interface PortfolioRow {
  id: string;
  learnerId: string;   // internal only
  capstoneId: string;
  displayName: string | null;
  skills: Skill[];
  issuedAt: Date;
  revokedAt: Date | null;
}

export interface PortfolioRepo {
  /** Idempotent: returns existing row for (learnerId, capstoneId) if present. */
  create(row: Omit<PortfolioRow, "issuedAt" | "revokedAt">): Promise<PortfolioRow>;
  findById(id: string): Promise<PortfolioRow | null>;
  revoke(id: string): Promise<boolean>;
}

export class PgPortfolioRepo implements PortfolioRepo {
  constructor(private pool: pg.Pool) {}
  private map(r: any): PortfolioRow {
    return {
      id: r.id, learnerId: r.learner_id, capstoneId: r.capstone_id, displayName: r.display_name,
      skills: r.skills, issuedAt: r.issued_at, revokedAt: r.revoked_at,
    };
  }
  async create(row: Omit<PortfolioRow, "issuedAt" | "revokedAt">) {
    // ON CONFLICT DO UPDATE no-op so RETURNING always yields the existing row
    const { rows } = await this.pool.query(
      `INSERT INTO portfolios (id, learner_id, capstone_id, display_name, skills)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (learner_id, capstone_id) DO UPDATE SET learner_id = EXCLUDED.learner_id
       RETURNING *`,
      [row.id, row.learnerId, row.capstoneId, row.displayName, JSON.stringify(row.skills)],
    );
    return this.map(rows[0]);
  }
  async findById(id: string) {
    const { rows } = await this.pool.query("SELECT * FROM portfolios WHERE id = $1", [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }
  async revoke(id: string) {
    const { rowCount } = await this.pool.query(
      "UPDATE portfolios SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
    return (rowCount ?? 0) > 0;
  }
}

export class MemoryPortfolioRepo implements PortfolioRepo {
  rows = new Map<string, PortfolioRow>();
  async create(row: Omit<PortfolioRow, "issuedAt" | "revokedAt">) {
    for (const r of this.rows.values()) {
      if (r.learnerId === row.learnerId && r.capstoneId === row.capstoneId) return r;
    }
    const full = { ...row, issuedAt: new Date(), revokedAt: null };
    this.rows.set(row.id, full);
    return full;
  }
  async findById(id: string) { return this.rows.get(id) ?? null; }
  async revoke(id: string) {
    const r = this.rows.get(id);
    if (!r || r.revokedAt) return false;
    r.revokedAt = new Date();
    return true;
  }
}
