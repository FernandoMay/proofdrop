# Demo walkthrough

Two paths, same code. Sections 1-6 are the deterministic local demo and need no secrets. Section 7
is the live Testnet deployment. Section 8 covers troubleshooting.

## 1. Start

From the ProofDrop repository:

```bash
npm install
npm run dev:demo
```

Expected local endpoints:

- Web: <http://localhost:3000>
- API health: <http://localhost:4000/health>
- API host in demo mode: `127.0.0.1`

`npm run dev:demo` builds the shared package before starting Next.js and Fastify. Stop both with
`Ctrl+C`.

## 2. Create visible evidence

1. Open the web app and select **Crear solicitud**.
2. Enter a title and an amount with no more than seven decimal places.
3. The API returns a `demo-*` identifier and normalizes the amount.
4. The pay page shows `MODO DEMO` and a `SIMULATED` record banner.
5. Select **Ejecutar flujo completo**. The client submits three commands sequentially:
   - verify payment;
   - create manifest;
   - anchor manifest.
6. Open **Prueba pública**.

The proof page contains the canonical manifest and a real SHA-256 digest of its canonical bytes.
The digest is deterministic for the generated manifest. It is not evidence of a Stellar payment.

## 3. What demo mode does

| Adapter | Demo behavior |
|---------|---------------|
| Repository | In-memory, cleared when the API restarts |
| Stellar | Deterministic `SIMULATED-STELLAR-*` label; no Horizon request |
| Avalanche | Deterministic simulation result; no wallet, RPC transaction, receipt, or event |
| Pollar | Optional browser client; no provider or Pollar call when no publishable key is configured |

With the default empty `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`, real-mode payment pages retain the
manual external-wallet hash fallback and never mount `PollarProvider`.

Demo anchor evidence deliberately has null contract address, transaction hash, block, log, and
anchorer. The UI does not render a Stellar or Avalanche evidence card unless that evidence was
actually verified on the configured network.

## 4. Inspect the API flow

```bash
curl http://localhost:4000/health
```

Create a request from PowerShell:

```powershell
$body = @{ title = "Demo invoice"; description = "Visible simulation"; amount = "1.25" } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/proof-drops -ContentType "application/json" -Body $body
$id = $created.data.request.publicId
```

Verify, create, and anchor using the returned IDs:

```powershell
$verified = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/proof-drops/$id/verify-payment" -ContentType "application/json" -Body "{}"
$proof = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/proof-drops/$id/proof" -ContentType "application/json" -Body "{}"
$proofId = $proof.data.proof.publicId
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/v1/proofs/$proofId/anchor" -ContentType "application/json" -Body "{}"
```

Repeating the proof or anchor command returns the same deterministic manifest and final simulated
state. Concurrent proof requests are serialized per request and also return the same proof.
Demo mode does not require a mutation secret; real mode does.

## 5. Browser-facing mutation proxy

The browser does not call the three mutation endpoints directly. It calls the same-origin Next.js
route, which accepts only these exact `POST` paths and forwards JSON to `API_URL`:

- `/api/v1/proof-drops/:id/verify-payment`
- `/api/v1/proof-drops/:id/proof`
- `/api/v1/proofs/:proofId/anchor`

For a local run, the same flow can be exercised through port `3000`:

```powershell
$verified = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/proxy/api/v1/proof-drops/$id/verify-payment" -ContentType "application/json" -Body "{}"
$proof = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/proxy/api/v1/proof-drops/$id/proof" -ContentType "application/json" -Body "{}"
$proofId = $proof.data.proof.publicId
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/proxy/api/v1/proofs/$proofId/anchor" -ContentType "application/json" -Body "{}"
```

The proxy reads `API_MUTATION_SECRET` only on the Next.js server and adds the API header in real
mode. It rejects unknown paths, path traversal, query strings, and non-POST methods. Demo mode
works without a secret. The API continues to enforce the secret directly as defense in depth.

## 6. Expected limitation

The in-memory repository is process-local. Restarting the API removes demo records, so old URLs
return `404`. This is intentional for a zero-configuration demo and is not production persistence.

## 7. Live deployment (real Testnet)

The deployed stack runs the same code with `DEMO_MODE=false` and Testnet/Fuji configuration.

| Step | Where |
|------|-------|
| Open the app | <https://proof-drop.netlify.app> |
| Check the API | <https://proofdrop.onrender.com/health> |
| Create a request | **Crear solicitud** on the landing page |
| Pay with Pollar (optional) | The pay page, when a `pub_testnet_...` key is configured |
| Pay manually | Stellar testnet account sends the exact USDC amount to the configured recipient with `memo_type=text` and the `PD-XXXXXXXX` ID as the text memo |
| Verify | The pay page posts the transaction hash; the API re-reads it from Horizon |
| Build the proof | The API serializes the canonical manifest and publishes its SHA-256 |
| Anchor (optional) | The API writes to Fuji only after the Stellar evidence exists |
| Read the evidence | `/proof/PD-XXXXXXXX` |

Pollar is optional and non-authoritative. If Google sign-in is offered, Pollar returns a transaction
hash, and that hash is only a verification candidate. The API independently reads Horizon and
rejects the payment unless the classic USDC asset, issuer, amount, recipient, and `memo_type=text`
memo all match. If Pollar is unconfigured, use the manual hash field instead — the rest of the flow
is identical.

> **A Render restart invalidates live records.** The Render service keeps records in memory, so any
> restart, redeploy, or cold start makes existing `/proof/PD-XXXXXXXX` and `/pay/PD-XXXXXXXX` URLs
> return `404`. The Stellar payment and the Avalanche anchor stay on their networks. Create a new
> request and re-verify to get a fresh URL.

## 8. Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| Pollar Google sign-in fails or loops back | The Pollar dashboard must list the exact web origin as an allowed redirect URI. `http://localhost:3000` locally and `https://proof-drop.netlify.app` deployed are different URIs, and a trailing slash or a different port is a different URI again. Fix the dashboard entry, then reload. |
| Pollar panel is missing | `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` is unset or is not a `pub_testnet_...` key. The manual hash flow still works. |
| An existing proof URL returns `404` | The API restarted and lost its in-memory records. Create a new request. |
| Anchor returns `unconfigured` | `AVALANCHE_PRIVATE_KEY` or `AVALANCHE_REGISTRY_ADDRESS` is missing on the API. |
| A real mutation is rejected | The server-only `API_MUTATION_SECRET` is missing, or differs between Render and Netlify. |
| Health reports `demo` when real mode was expected | `DEMO_MODE` is still `true`, or the environment file was not reloaded after editing. |
