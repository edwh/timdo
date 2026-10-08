-- Migration: 0007_api_tokens.sql
-- Personal access tokens for the CLI and MCP. Each acts only as its owner, can be revoked,
-- and only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS ApiTokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL, -- first characters, for recognising a token in the list
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON ApiTokens(user_id);
