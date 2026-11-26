CREATE TABLE IF NOT EXISTS portfolios (
  id            TEXT PRIMARY KEY,               -- random public id embedded in the signed token
  learner_id    UUID NOT NULL,                  -- internal only, never returned by public endpoints
  capstone_id   TEXT NOT NULL,
  display_name  TEXT,                           -- optional learner-chosen public alias (not legal name)
  skills        JSONB NOT NULL,                 -- [{ "skill": "...", "level": "...", "evidence": "..." }]
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (learner_id, capstone_id)              -- makes "complete capstone" idempotent
);
