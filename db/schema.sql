CREATE TABLE accounts (
  id               SERIAL PRIMARY KEY,
  provider         TEXT NOT NULL,
  email            TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, email)
);

CREATE TABLE emails (
  id          BIGSERIAL PRIMARY KEY,
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sender      TEXT,
  subject     TEXT,
  body_html   TEXT,
  body_text   TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  tags        JSONB NOT NULL DEFAULT '[]',
  UNIQUE (account_id, external_id)
);
CREATE INDEX emails_received_at_idx ON emails (received_at DESC);
