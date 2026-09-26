# ProofDrop

**One USDC micro-payment on Stellar Testnet, with a public evidence URL anyone can recompute.**

ProofDrop creates a payment request, verifies one exact classic Stellar payment, hashes a canonical
manifest with SHA-256, optionally anchors that hash on **Avalanche Fuji C-Chain**, and publishes a
public proof URL. Stellar is the payment authority and always comes first; Avalanche is a strictly
sequential, optional anchor. Pollar is an optional browser payment rail and is never authoritative.

## Quick path

**See it running — the live deployment:**

| What | URL |
|------|-----|
| Web app | <https://proof-drop.netlify.app> |
| API health | <https://proofdrop.onrender.com/health> |
| API root | <https://proofdrop.onrender.com> |

> **Hard limitation: the live API stores records in memory.** The Render service runs a
> process-local, in-memory repository. A restart, redeploy, or cold start loses every record, so a
> public proof URL can return `404` even though the Stellar payment and the Avalanche anchor remain
> permanent on their networks. Nothing in this deployment is durable storage. See
> [Deployment limits](#deployment-limits).

**Run it yourself — deterministic demo, no secrets.** Requires Node.js 24 and npm 11.

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

## Demo mode vs real Testnet mode

| | Demo mode | Real Testnet mode |
|---|---|---|
| Start with | `npm run dev:demo` | `DEMO_MODE=false` plus the variables below |
| Labels | `SIMULATED` throughout | Real Horizon and Fuji evidence |
| Stellar | Deterministic `SIMULATED-STELLAR-*` label, no Horizon request | Exact classic USDC `Payment` re-read from Horizon Testnet |
| Avalanche | Deterministic simulation, no transaction | Optional `AnchorRegistry` write on Fuji, only after the Stellar step |
| Record IDs | `demo-*`, `demo-proof-*` | `PD-XXXXXXXX` |
| Mutation secret | Not required | Server-only `API_MUTATION_SECRET` required |
| Records | Cleared on API restart | Cleared on API restart (in-memory) |

Use demo mode for a deterministic, secret-free walkthrough. Use real mode only once the Stellar and
Fuji variables are configured; a manifest can be built without Avalanche configuration, but the
anchor endpoint returns `unconfigured` until both Fuji values are present.

## Repository map

| Area | Purpose |
|------|---------|
| `apps/web` | Next.js App Router UI in neutral professional Spanish |
| `apps/web/public/brand` | Web-served brand assets; the only images the app loads |
| `services/api` | Fastify REST API, state machine, repository, and network adapters |
| `packages/shared` | Domain types, validation, canonical JSON, manifest, and SHA-256 helpers |
| `contracts/avalanche` | Cancun Solidity `AnchorRegistry`, Foundry tests, and deploy script |
| `contracts/stellar` | Explains why no Soroban registry is required for the MVP |
| `assets` | Supplied source brand artwork; not served at runtime |
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

## Brand assets

Source artwork lives in [`assets/`](assets/README.md) and is never served at runtime. The derived,
web-optimized files in `apps/web/public/brand/` are the only images the app loads.

| Path | Dimensions | Role |
|------|------------|------|
| `assets/proofdrop.jpg` | 1408x768 JPEG | Supplied logo source (landscape) |
| `assets/proofdropcover.jpg` | 1376x768 JPEG | Supplied cover / hero artwork |
| `apps/web/public/brand/logo-192.png` | 192x192 PNG | Header brand mark, favicon, manifest icon |
| `apps/web/public/brand/logo-512.png` | 512x512 PNG | Web manifest icon |
| `apps/web/public/brand/apple-touch-icon.png` | 180x180 PNG | Apple touch icon |
| `apps/web/public/brand/cover.jpg` | 1200x670 JPEG | Landing hero brand visual |
| `apps/web/public/brand/og-cover.jpg` | 1200x630 JPEG | Open Graph and social preview |

The icon PNGs are a square center crop of the supplied logo, not a redrawn or squashed version.
`cover.jpg` keeps the source aspect ratio exactly; `og-cover.jpg` is the same artwork center-cropped
to the 1200x630 Open Graph ratio. Favicon, Open Graph, and web manifest references are declared in
`apps/web/app/layout.tsx` and `apps/web/public/site.webmanifest`. No author, license, or trademark
holder is asserted for the supplied images.

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

The API listener uses `API_PORT` and `API_HOST` first, then Render's standard `PORT` and `HOST`.
When Render supplies `PORT` (or an explicit `RENDER` indicator is enabled) and neither host
override is set, the host defaults to `0.0.0.0`; otherwise local development stays on
`127.0.0.1:4000`. The Render service must bind to `0.0.0.0`: a loopback-only listener is not
reachable through Render.

## Render Blueprint deployment

The root [`render.yaml`](render.yaml) defines one Node web service named `proofdrop` from
`https://github.com/FernandoMay/proofdrop`, on `main`, with the free plan, one instance, the
`/health` check, and automatic deployment on commits. Its build installs every workspace, builds
`@proofdrop/shared`, and then builds the API. The configured Stellar and Avalanche values are
Testnet/Fuji values; the private key and mutation secret are deliberately prompted for and are not
stored in the Blueprint.

### Deploy the API

1. In the Render dashboard, choose **New → Blueprint**.
2. Connect `https://github.com/FernandoMay/proofdrop` and select the `main` branch. Render reads
   `render.yaml` from the repository root.
3. Review the `proofdrop` service. When prompted, enter `API_MUTATION_SECRET` and the dedicated
   `AVALANCHE_PRIVATE_KEY`; do not paste either value into the repository or YAML.
4. Apply the Blueprint and wait for the build and health check to complete.
5. Verify the deployment at <https://proofdrop.onrender.com/health>. The expected service URL is
   <https://proofdrop.onrender.com>. A cold start on a free service can take a moment.

Later pushes to `main` trigger automatic deploys through the Blueprint's commit auto-deploy setting.

### Configure Netlify

In the Netlify site's **Environment variables** settings, set exactly these values:

| Variable | Value | Scope |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://proofdrop.onrender.com` | Public browser/server-rendered reads |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | `pub_testnet_...` or omit | Optional public Pollar browser configuration |
| `API_URL` | `https://proofdrop.onrender.com` | Server-only Next.js proxy target |
| `API_MUTATION_SECRET` | The same server-only value entered in Render | Server-only; never expose it as `NEXT_PUBLIC_*` |

Save the variables and trigger a new Netlify deploy. The browser continues to use the same-origin
Next.js proxy; it must not receive `API_MUTATION_SECRET` or the Avalanche private key. The exact
`WEB_ORIGIN=https://proof-drop.netlify.app` allowlist in `render.yaml` remains enabled—there is no
CORS wildcard.

### Deployment limits

**The live API's storage is in memory, so live records are not durable.** Render currently runs
ProofDrop against a process-local, in-memory repository. A restart, redeploy, or process replacement
loses its records, so a public proof URL such as `/proof/PD-XXXXXXXX` can return `404` for a record
that was real. The underlying Stellar payment and Avalanche anchor are unaffected: they stay on their
networks and remain independently checkable from the explorer links.

A free Render web service may also sleep after inactivity, and on either a free or paid plan the
service can be unavailable during a restart or cold start. Moving to a paid plan does not make this
in-memory repository durable. Use this path for a controlled hackathon demo, not production
persistence. `infra/postgres/schema.sql` is the intended replacement.

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
- Pollar is only an optional Stellar payment rail. A hash returned by Pollar is a verification
  candidate, while Horizon remains the payment authority and Avalanche remains the proof anchor.
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
- A public URL depends on the configured API and repository. The in-memory repository loses records
  on restart, so a live public proof URL is availability, not durability.
- The Solidity registry stores a hash and Stellar transaction label. It does not call Horizon.
- No claim is made about Mainnet, atomic settlement, a benchmark, an audit, Merkle verification,
  or ZK cryptography.

## Optional Pollar client

Pollar is an optional browser payment rail, not a ProofDrop verifier. The web app pins
`@pollar/react@0.11.3` and `@pollar/core@0.11.3`, mounts `PollarProvider` only for a valid
Testnet publishable key, and can offer Google login plus the SDK's built-in Freighter login. Pollar
may build, sign, and submit the exact Stellar payment, including the request ID as a text memo.

### Enable Pollar

1. Sign in at [dashboard.pollar.xyz](https://dashboard.pollar.xyz).
2. Open **Build → API Keys → Generate**.
3. Select a **Publishable** key for **Testnet** and copy the `pub_testnet_...` value.
4. Set `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` in the web runtime (for example, Netlify) and rebuild.
5. Allow the local or deployed web origin in the Pollar dashboard when prompted.

The `pub_` key is designed for browser use and is replaced into the client bundle at build time. A
`sec_` key is server-only; this integration does not need one. Never add a Pollar secret key to
Render, GitHub, `.env.example`, or any `NEXT_PUBLIC_*` variable. Render continues to host only the
ProofDrop API, and its health response keeps Pollar `unconfigured` because no server adapter is used.
Leaving the publishable key unset or blank keeps the existing manual hash flow fully available.

A Pollar `success` or `pending` outcome contributes only its returned Stellar hash. The existing
PayActions verification action sends that hash to the ProofDrop backend, which independently checks
the exact Horizon payment, classic USDC asset and issuer, amount, recipient, and `memo_type=text`
request ID. Pollar does not verify Avalanche or the canonical proof, and the cross-chain flow is not
atomic. See `services/api/src/adapters/pollar.ts` for the non-authoritative server boundary.

## More documentation

- [`docs/architecture.md`](docs/architecture.md) — components, state, production topology, and data flow
- [`docs/demo.md`](docs/demo.md) — deterministic demo walkthrough plus the live Testnet path and troubleshooting
- [`docs/evidence.md`](docs/evidence.md) — what each artifact proves, the captured run, and current deployment status
- [`assets/README.md`](assets/README.md) — supplied source brand assets and their derived public versions
- [`contracts/avalanche/README.md`](contracts/avalanche/README.md) — contract setup and deployment

## License

MIT. See [`LICENSE`](LICENSE).
