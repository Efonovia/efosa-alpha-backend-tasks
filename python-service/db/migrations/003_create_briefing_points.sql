CREATE TABLE IF NOT EXISTS briefing_points (
  id            SERIAL PRIMARY KEY,
  briefing_id   INTEGER      NOT NULL REFERENCES briefings (id) ON DELETE CASCADE,
  point_type    VARCHAR(20)  NOT NULL CHECK (point_type IN ('key_point', 'risk')),
  content       TEXT         NOT NULL,
  display_order INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_briefing_points_briefing_id ON briefing_points (briefing_id);
