CREATE TABLE firms_request_budget (
  id TEXT PRIMARY KEY NOT NULL,
  minute INTEGER NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 1 AND used <= 10)
);
