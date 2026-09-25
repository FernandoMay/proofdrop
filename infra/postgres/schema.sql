CREATE TABLE proof_drop_requests (
  public_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('demo', 'real')),
  state text NOT NULL CHECK (
    state IN ('pending', 'payment_submitted', 'payment_verified', 'anchor_pending', 'anchored', 'verified', 'failed', 'simulated')
  ),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount text NOT NULL,
  recipient text NOT NULL,
  memo text NOT NULL UNIQUE,
  asset_network text NOT NULL,
  asset_type text NOT NULL DEFAULT 'classic' CHECK (asset_type = 'classic'),
  asset_code text NOT NULL,
  asset_issuer text NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT proof_drop_requests_public_mode_key UNIQUE (public_id, mode),
  CONSTRAINT proof_drop_requests_mode_network_ck CHECK (
    (mode = 'demo' AND asset_network = 'SIMULATED')
    OR (mode = 'real' AND asset_network = 'Stellar Testnet')
  ),
  CONSTRAINT proof_drop_requests_amount_ck CHECK (
    amount ~ '^(0|[1-9][0-9]*)\.[0-9]{7}$' AND amount <> '0.0000000'
  ),
  CONSTRAINT proof_drop_requests_mode_id_ck CHECK (
    (mode = 'demo' AND public_id LIKE 'demo-%')
    OR (mode = 'real' AND public_id ~ '^PD-[A-F0-9]{8}$')
  )
);

CREATE TABLE proof_drop_payments (
  request_id text PRIMARY KEY REFERENCES proof_drop_requests(public_id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('pending', 'payment_submitted', 'payment_verified', 'failed')),
  verification text NOT NULL CHECK (verification IN ('not_checked', 'verified', 'simulated', 'unconfigured', 'failed')),
  transaction_hash text,
  evidence jsonb,
  last_error text,
  updated_at timestamptz NOT NULL
);

CREATE TABLE proof_drop_proofs (
  proof_id text PRIMARY KEY,
  request_id text NOT NULL,
  request_mode text NOT NULL CHECK (request_mode IN ('demo', 'real')),
  state text NOT NULL CHECK (state IN ('pending', 'anchor_pending', 'anchored', 'verified', 'failed', 'simulated')),
  manifest jsonb NOT NULL,
  manifest_hash char(64) NOT NULL UNIQUE CHECK (manifest_hash ~ '^[a-f0-9]{64}$'),
  anchor_verification text NOT NULL CHECK (anchor_verification IN ('not_checked', 'verified', 'simulated', 'unconfigured', 'failed')),
  anchor_evidence jsonb,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT proof_drop_proofs_request_mode_fk
    FOREIGN KEY (request_id, request_mode)
    REFERENCES proof_drop_requests(public_id, mode)
    ON DELETE CASCADE,
  CONSTRAINT proof_drop_proofs_request_uk UNIQUE (request_id),
  CONSTRAINT proof_drop_proofs_mode_id_ck CHECK (
    (request_mode = 'demo' AND proof_id ~ '^demo-proof-[0-9a-f]{8}$')
    OR (request_mode = 'real' AND proof_id ~ '^PD-[A-F0-9]{8}$')
  )
);

CREATE INDEX proof_drop_requests_recent_idx ON proof_drop_requests (created_at DESC);
CREATE INDEX proof_drop_payments_state_idx ON proof_drop_payments (verification, state);
CREATE INDEX proof_drop_proofs_anchor_idx ON proof_drop_proofs (anchor_verification, state);
