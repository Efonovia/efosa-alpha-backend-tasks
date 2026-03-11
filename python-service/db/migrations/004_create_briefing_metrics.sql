CREATE TABLE IF NOT EXISTS briefing_metrics (
  id            SERIAL PRIMARY KEY,
  briefing_id   INTEGER      NOT NULL REFERENCES briefings (id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  value         VARCHAR(120) NOT NULL,
  display_order INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT uq_briefing_metric_name UNIQUE (briefing_id, name)
);

CREATE INDEX IF NOT EXISTS idx_briefing_metrics_briefing_id ON briefing_metrics (briefing_id);
