# ProofDrop architecture

## System answer

ProofDrop is a sequential, two-network saga. The API verifies Stellar first, derives a canonical
SHA-256 manifest, and only then may request an Avalanche Fuji anchor. Neither step is atomic with
the other, and the public hash alone does not prove that a payment exists.

```text
Browser
  |-- optional Pollar SDK -----> Stellar Testnet payment submission
  |
  | same-origin JSON /api/proxy/* for mutations
  v
Next.js route handler ---- allowlisted server-only mutation boundary
  |
  | REST/JSON + server-side mutation header
  v
Fastify API ---- ProofDropService ---- Repository
  |                    |
  |                    +----------- Canonical manifest + SHA-256
  |
  +-- Horizon adapter ------> Stellar Testnet verification
  +-- viem adapter -----------> Avalanche Fuji anchoring
  +-- disabled, non-authoritative Pollar server boundary
```

The Next.js server reads the API for dynamic pages and forwards only the three intended evidence
mutations through `/api/proxy/*`. It reads `API_MUTATION_SECRET` server-side in real mode; the
browser never receives that value. Small client components submit same-origin commands and refresh
server-rendered evidence. The Fastify API remains the source of truth and checks the mutation
header independently. When `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` contains a valid `pub_testnet_`
key, a client-only boundary mounts Pollar on Stellar Testnet. The no-key path omits that provider
and preserves the manual hash flow.

## Workspace boundaries

| Workspace | Responsibility | Must not own |
|-----------|----------------|--------------|
| `packages/shared` | Domain contracts, state-independent validation, canonical JSON, manifest hash | Network calls or persistence |
| `services/api` | HTTP validation, orchestration, adapters, repository use, secret handling | UI copy or wallet custody |
| `apps/web` | Spanish product UX, server-rendered evidence, optional Pollar browser client, explicit simulation labels | Private keys, Horizon logic, fabricated hashes |
| `contracts/avalanche` | Idempotent manifest-hash registry for Fuji | Stellar verification or atomicity |
| `infra/postgres` | SQL schema for a future repository adapter | Demo startup requirements |

## State machine

The aggregate state only moves forward:

```text
pending
  -> payment_submitted
  -> payment_verified
  -> anchor_pending
  -> anchored
  -> verified
```

Any non-terminal state can become `failed`. Demo anchoring terminates at `simulated`. Terminal
states have no outgoing transitions. Repeating the same command returns the existing record rather
than rolling state backward.

The component records carry their own state and evidence status:

- payment: `pending`, `payment_submitted`, `payment_verified`, or `failed`;
- proof: `pending`, `anchor_pending`, `anchored`, `verified`, `failed`, or `simulated`;
- verification: `not_checked`, `verified`, `simulated`, `unconfigured`, or `failed`.

An unconfigured external adapter does not advance a record. Transient network errors also leave the
record at its prior state. A deterministic evidence mismatch can terminally fail payment
verification.

## Demo and real identities

- Demo request IDs: `demo-<hex>`.
- Demo proof IDs: `demo-proof-<hex>`.
- Real request and proof IDs: `PD-XXXXXXXX`.

Demo transaction evidence uses a visible label such as `SIMULATED-STELLAR-<request-id>`, and the
shared manifest records the network as `SIMULATED`. It never uses a 64-hex transaction value and
never receives an explorer link. Demo anchor evidence has null contract, transaction, block, log,
and anchorer fields.

## Canonical manifest

`packages/shared/src/manifest.ts` creates `proofdrop.manifest.v1` from the request, exact asset, and
verified payment fields. `packages/shared/src/canonical-json.ts` recursively sorts object keys and
serializes without whitespace. Amounts are normalized to fixed seven-decimal strings using decimal
string operations; no floating-point conversion is used.

The hash is:

```text
SHA-256(UTF-8(canonical JSON bytes))
```

The same manifest object and `hashProofManifest` function can independently recompute the digest.
The public view displays the manifest and digest but labels the digest as a public hash, never as
ZK or Merkle evidence.

## Stellar adapter

In real mode, the adapter requests the exact transaction from the configured Horizon endpoint and
then requests `/transactions/{hash}/operations` for the real operations collection. It requires:

1. the configured identity to be the supported Stellar Testnet Horizon endpoint;
2. the returned hash to equal the submitted lowercase 64-hex hash;
3. `successful === true` and a valid ledger;
4. exactly one matching classic `Payment` operation;
5. `credit_alphanum4`, exact USDC code, exact configured issuer;
6. exact seven-decimal amount and configured recipient;
7. `memo_type === "text"` and a text memo equal to the request public ID.

The sender is captured as evidence, but ProofDrop does not claim to know the payer before querying.
A successful transaction hash alone is rejected as insufficient evidence.

## Avalanche adapter

The adapter uses viem with Avalanche Fuji C-Chain (`43113`). Before writing, it queries
`eth_chainId` and refuses evidence unless the configured endpoint returns `43113`. It writes
`anchor(manifestHash, stellarTxHash)` to the configured registry and waits for a receipt. It then checks:

- receipt success and destination;
- exactly one matching registry log and decoded event arguments;
- the event timestamp against the block timestamp;
- the `getAnchor` getter against the emitted event.

A real anchor is considered verified only after these checks. Missing private key or registry
address returns `unconfigured`; it never returns a successful placeholder transaction.

## Repository

`ProofDropRepository` defines create, save, request lookup, proof lookup, and recent-list operations.
The in-memory implementation clones records at every boundary to avoid accidental external
mutation. The service serializes proof creation per request with a bounded lock and releases it
after completion, so concurrent `Promise.all` requests return the same proof instead of orphaning a
later result. It is safe for a local single-process demo, not durable or horizontally scalable.

Real-mode `verify-payment`, `proof`, and `anchor` routes require the server-only
`API_MUTATION_SECRET` header. The Next.js `/api/proxy/*` route adds that header only after
validating the exact `POST` path, JSON body, and server `API_URL`; demo mode does not require it.
The secret is never included in web client code, and the Fastify API checks the header directly as
defense in depth.

`infra/postgres/schema.sql` is the production schema. It uses a composite foreign key from each
proof to `(request_id, request_mode)` so PostgreSQL enforces the demo/real identity relationship
without subqueries in a CHECK constraint. A PostgreSQL implementation should update request,
payment, and proof records in one database transaction and enforce state/version preconditions. The
MVP does not load a database driver or require PostgreSQL.

## Pollar boundary

Pollar is a browser client and optional Stellar payment rail. With a valid
`NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` (`pub_testnet_...`), `PollarProvider` is mounted only after
client mount. The payment component uses `runTx("payment", ...)` with the request's destination,
amount, exact classic USDC asset, and text request ID as the memo. It offers Google and the SDK's
built-in Freighter login, displays the authenticated address, and opens Pollar history.

Only a hash returned with a `success` or `pending` outcome enters the existing PayActions hash
field. A `pending` hash is not accepted until the user invokes the existing Horizon verification
action; an SDK error is displayed without adopting any hash or claiming success. The API remains the
independent payment verifier, and no Pollar response advances the payment or proof state directly.

The server adapter stays disabled and reports `client_optional`; it makes no Pollar network call
and is non-authoritative. API health continues to report the server-side Pollar boundary as
`unconfigured`, independently of whether the browser has a publishable key. Pollar does not verify
Avalanche, the canonical hash, or cross-network atomicity. Without a key, the provider and Pollar
payment controls are absent and manual hash verification remains available.
