# ProofDrop

ProofDrop is a small, verifiable micro-payment flow for **Stellar Testnet USDC**. It creates a
payment request, verifies one exact classic Stellar payment, hashes a canonical manifest with
SHA-256, optionally anchors that hash on **Avalanche Fuji C-Chain**, and exposes a public proof URL.

The repository runs in an explicit **simulated demo mode** with no secrets. Real adapters stay
unconfigured until their environment variables are supplied.

## Quick demo

Prerequisites: Node.js 24 and npm 11.

```bash
cd "C:\Users\FMAYF\OneDrive - Instituto Politecnico Nacional\Documents\proofdrop"
npm install
npm run dev:demo
```

Open <http://localhost:3000>, then:

1. Select **Crear solicitud**.
2. Enter a concept and an amount such as `1.25`.
3. On the pay page, select **Ejecutar flujo completo**.
4. Open the generated public proof route.

The UI and API mark this path `SIMULATED`. No payment or Avalanche transaction is submitted, demo
transaction labels are not 64-character hex hashes, and no explorer links are generated.

## Repository map

| Area | Purpose |
|------|---------|
| `apps/web` | Next.js App Router UI in neutral professional Spanish |
| `services/api` | Fastify REST API, state machine, repository, and network adapters |
| `packages/shared` | Domain types, validation, canonical JSON, manifest, and SHA-256 helpers |
| `contracts/avalanche` | Cancun Solidity `AnchorRegistry`, Foundry tests, and deploy script |
| `contracts/stellar` | Explains why no Soroban registry is required for the MVP |
| `infra/postgres/schema.sql` | Production persistence schema; demo does not require PostgreSQL |
| `docs` | Architecture, demo walkthrough, and evidence boundaries |

## Commands

| Command | Result |
|---------|--------|
| `npm run dev:demo` | Starts web on `3000` and API on `4000` in simulated mode |
| `npm run dev:api` | Starts only the API with the current root `.env` |
| `npm run dev:web` | Starts only the web app |
| `npm run typecheck` | Builds shared declarations, then checks API and web TypeScript |
| `npm test` | Runs shared and API Vitest suites |
| `npm run build` | Builds shared, compiles the API, and creates the Next.js production build |

## Environment

```bash
copy .env.example .env
```

`DEMO_MODE=true` is the safe default. Never commit `.env`; it is ignored.

For real testnet mode, set:

```dotenv
DEMO_MODE=false
API_URL=http://localhost:4000
API_MUTATION_SECRET=<server-only random secret>
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_CODE=USDC
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
STELLAR_RECIPIENT_PUBLIC_KEY=<your Stellar G account>
AVALANCHE_NETWORK=fuji
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_PRIVATE_KEY=<Fuji test key>
AVALANCHE_REGISTRY_ADDRESS=<deployed AnchorRegistry>
```

`API_URL` is read only by the Next.js server route at `/api/proxy/*`; `NEXT_PUBLIC_API_URL` is
used for public/server-rendered reads. `API_MUTATION_SECRET` is also server-only. The Next route
forwards only these three `POST` paths to `API_URL` and adds
`X-ProofDrop-Mutation-Secret` in real mode:

- `/api/v1/proof-drops/:id/verify-payment`
- `/api/v1/proof-drops/:id/proof`
- `/api/v1/proofs/:proofId/anchor`

The browser calls the same-origin Next proxy, never the API mutation secret or the direct API
boundary. If real mode has no `API_MUTATION_SECRET`, the proxy returns a clear configuration error
before contacting the API. Demo mode works without a secret and does not add the header. The API
still checks the header independently as defense in depth.

The Avalanche private key is read only by the API process. Use a dedicated Fuji-only key. The
Stellar sender wallet is external: it must have a USDC trustline and must pay the configured
recipient with the request ID as the exact text memo.

A real Stellar record can be created when the recipient is configured. Its manifest can be built
without Avalanche configuration, but the anchor endpoint returns `unconfigured` until both Fuji
values are present.

## API routes

All errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": []
  }
}
```

| Method | Route | Behavior |
|--------|-------|----------|
| `GET` | `/health` | Mode and adapter readiness, without secrets |
| `GET` | `/api/v1/proof-drops?limit=20` | Recent repository records used by the dashboard |
| `POST` | `/api/v1/proof-drops` | Create a validated request |
| `GET` | `/api/v1/proof-drops/:publicId` | Read request, payment, and optional proof state |
| `POST` | `/api/v1/proof-drops/:publicId/verify-payment` | Verify the exact Stellar payment; real mode requires the server mutation secret |
| `POST` | `/api/v1/proof-drops/:publicId/proof` | Build one deterministic canonical manifest; real mode requires the server mutation secret |
| `POST` | `/api/v1/proofs/:proofId/anchor` | Sequentially anchor the manifest on Fuji; real mode requires the server mutation secret |
| `GET` | `/api/v1/proofs/:publicId` | Read the public evidence view |

### Browser mutation proxy

The web client sends browser mutations to the same-origin Next.js route
`/api/proxy/api/v1/...`; the server route validates the method and exact allowlisted path before
forwarding JSON to `API_URL`. Unknown routes, path traversal, query strings, and non-POST methods
are rejected. The proxy is not a general-purpose API proxy. Its server response forwards the API
status and JSON body without adding a secret to the client bundle.

Demo IDs begin with `demo-` or `demo-proof-`. Real IDs use `PD-XXXXXXXX`. A repeated proof or anchor
request is idempotent.

## Trust boundaries

- A canonical **public hash is not a zero-knowledge proof** and does not by itself prove payment.
- Stellar payment verification and Avalanche anchoring are separate, sequential transactions.
- Horizon success is insufficient: the API reads `/transactions/{hash}` and the separate
  `/transactions/{hash}/operations` collection, then matches one exact classic USDC `Payment`
  operation, amount, asset issuer/code,
  expected recipient, and exact `memo_type = "text"` request memo. Amounts use Stellar's seven
  decimal places without floating-point conversion.
- Real adapters accept only the configured supported network identities. Avalanche evidence also
  requires an RPC response proving chain ID `43113`; public Horizon evidence stores only a safe
  endpoint origin.
- Real evidence-changing routes require a server-only mutation secret. The browser uses the
  same-origin allowlisted Next.js proxy; the API still enforces the header directly. Demo mode
  remains frictionless and visibly `SIMULATED`.
- A public URL depends on the configured API and repository; the in-memory demo repository loses
  records on restart.
- The Solidity registry stores a hash and Stellar transaction label. It does not call Horizon.
- No claim is made about Mainnet, atomic settlement, a benchmark, an audit, Merkle verification,
  or ZK cryptography.

## Pollar

The Pollar boundary is intentionally disabled. No hackathon-specific endpoint, credential, or
verification contract is known, so ProofDrop does not invent one or claim Pollar verification. See
`services/api/src/adapters/pollar.ts`.

## More documentation

- [`docs/architecture.md`](docs/architecture.md) — components, state, and data flow
- [`docs/demo.md`](docs/demo.md) — deterministic first-run walkthrough
- [`docs/evidence.md`](docs/evidence.md) — what each artifact proves and what it does not
- [`contracts/avalanche/README.md`](contracts/avalanche/README.md) — contract setup and deployment

## License

MIT. See [`LICENSE`](LICENSE).
