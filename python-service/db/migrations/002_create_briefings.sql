CREATE TABLE IF NOT EXISTS briefings (
  id            SERIAL PRIMARY KEY,
  company_name  VARCHAR(255) NOT NULL,
  ticker        VARCHAR(20)  NOT NULL,
  sector        VARCHAR(120) NOT NULL,
  analyst_name  VARCHAR(120) NOT NULL,
  summary       TEXT         NOT NULL,
  recommendation TEXT        NOT NULL,
  is_generated  BOOLEAN      NOT NULL DEFAULT FALSE,
  generated_at  TIMESTAMPTZ,
  generated_html TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_ticker ON briefings (ticker);
