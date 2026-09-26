# Evidence and trust boundaries

## Evidence ladder

| Artifact | Establishes | Does not establish |
|----------|--------------|--------------------|
| Stellar transaction hash | Identifies a transaction document at Horizon | Successful execution or the requested asset/amount by itself |
| Horizon payment evidence | Successful ledger transaction containing the exact classic USDC Payment operation | Avalanche anchoring or atomicity |
| Pollar SDK outcome/hash | Pollar returned an outcome and transaction hash for its optional payment flow | ProofDrop payment acceptance, Avalanche anchoring, or atomicity |
| Canonical manifest | Exact ProofDrop request and accepted payment fields in a deterministic serialization | That the stored fields are truthful without checking payment evidence |
| SHA-256 public hash | Integrity/recomputation check for those manifest bytes | Payment existence, privacy, zero knowledge, or consensus finality |
| Avalanche registry event | Fuji receipt included an anchor for the hash and Stellar transaction label | That Horizon verification happened atomically with the event |
| Public proof URL | Availability of the API's current record view | Durable storage unless a production repository is connected |

## Stellar acceptance rule

A real payment is accepted only when the configured Horizon Testnet document has all of these
facts:

- returned transaction hash equals the submitted hash;
- `successful` is `true`;
- a valid ledger is present;
- exactly one operation matches `type = payment`;
- asset type is `credit_alphanum4`;
- asset code and issuer equal the configured USDC asset;
- amount equals the request after seven-decimal normalization;
- destination equals the configured recipient;
- `memo_type` is exactly `text` and the text memo equals the request public ID.

The operation index, sender, ledger, asset, and timestamp are stored as evidence. A valid Stellar
transaction can fail this check if any requested field differs.

## Avalanche acceptance rule

The real adapter first proves that the configured Avalanche RPC reports C-Chain chain ID
`43113`, then writes to the configured `AnchorRegistry`, waits for one confirmation, and requires:

- successful receipt sent by the configured account to the registry;
- no unexpected contract creation;
- exactly one decoded `ManifestAnchored` event from the registry;
- exact manifest hash, Stellar transaction hash, and configured sender/anchorer;
- event timestamp equal to the block timestamp;
- `getAnchor(manifestHash)` equal to the event.

Duplicate manifest hashes revert in Solidity. ProofDrop handles repeated API calls idempotently by
returning its already completed record. The minimal contract is permissionless, so another account
can submit a competing hash/transaction-label pair before the API; a production deployment should add
an authorized deployer/anchorer policy. A crash after submission but before the API saves the receipt
also needs an operational reconciliation path.

## Public hash language

ProofDrop uses "hash público" and "manifiesto canónico". It intentionally does not use:

- ZK or zero knowledge;
- Merkle proof;
- audited;
- Mainnet;
- atomic cross-chain flow;
- sub-second settlement;
- Snowman;
- Horizon V2 as an API version claim.

A public SHA-256 digest can be recomputed by anyone with the manifest. It says nothing by itself
about whether the payer intended the payment or whether a real payment exists.

## Pollar

Pollar is an optional browser payment rail. Its SDK may build, sign, and submit a Stellar payment,
but only a returned `success` or `pending` hash becomes a ProofDrop verification candidate. The
backend still reads that hash from the configured Horizon endpoint and independently requires the
exact classic USDC asset and issuer, amount, recipient, and `memo_type=text` request ID.

A Pollar `error` is displayed as an SDK error and never advances ProofDrop state, even if the SDK
response contains a hash. A `pending` hash remains unaccepted until the existing verification action
checks Horizon. Pollar transaction history is wallet UX, not proof evidence.

Pollar does not verify Avalanche, anchor the canonical manifest, or make Stellar settlement and
Avalanche anchoring atomic. `DisabledPollarAdapter` remains a non-authoritative server boundary: it
calls no Pollar endpoint and reports `client_optional`. When
`NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` is absent, the Pollar provider is not mounted and the existing
manual hash flow remains available.

## Captured live testnet run (2026-09-25)

**These are historical, locally captured values, not the current state of the deployed service.**
The run used the local ProofDrop API in `DEMO_MODE=false` with the dedicated testnet wallets. The
repository was process-local, so the identifiers and the public proof URL below belong to that one
run and do not describe the live deployment. Every value in this section was captured at the time of
the run and has not been re-verified since; the Stellar transaction and the Avalanche anchor are
permanent on their networks and remain independently checkable from the explorer links.

### Stellar settlement

| Field | Value |
|-------|-------|
| Network | Stellar Testnet |
| ProofDrop ID | `PD-8277BC0E` |
| Payment TX | `6c30a12bece551b1a74481eced1b44299e0dc1b4eaca5a19be4850b8e59dd191` |
| Ledger | `4857031` |
| Memo type | `text` |
| Memo | `PD-8277BC0E` |
| Amount | `1.2500000 USDC` |
| Sender | `GBZZKESMPSJYV66AM432APVCKUZSTZ34XFDOD7IMIB62QKK6UAU5SPSF` |
| Recipient | `GBUYX6AY5TLDD5O6ZZJBRUP36VTUNU2JRH7YXYYYOB74NLWTWRJVUFFO` |
| USDC issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Explorer | https://stellar.expert/explorer/testnet/tx/6c30a12bece551b1a74481eced1b44299e0dc1b4eaca5a19be4850b8e59dd191 |

Horizon returned one successful classic `payment` operation with exact asset, issuer, amount,
recipient, and text memo. The API independently read both the transaction document and the
`/transactions/{hash}/operations` collection.

### Canonical proof

| Field | Value |
|-------|-------|
| Proof ID | `PD-B32D2CCB` |
| Schema | `proofdrop.manifest.v1` |
| SHA-256 manifest hash | `c53b42bbccb4c1067b88b0838fdfa1e621a9cdf3ef6509b25d6e0215c3548919` |
| Public proof path | `/proof/PD-B32D2CCB` |

The public manifest hash is intentionally stored without an Ethereum `0x` prefix. The Avalanche
adapter prefixes it only at the viem `bytes32` boundary.

### Avalanche Fuji anchor

| Field | Value |
|-------|-------|
| Network | Avalanche Fuji C-Chain |
| Chain ID | `43113` |
| Registry | `0xf935193b98c53c25df88246f2a2fa78931a07d12` |
| Deployment TX | `0x1d8d1b1c4820bd5d2fddb09e20044c721a1a441ac45e3d2f26ccabe977671803` |
| Deployment block | `58693412` |
| Anchor TX | `0xbc3612b0e87711d045f1886a384507969c416c984e340ee2a09ffc916e14dab3` |
| Anchor block | `58694683` |
| Event manifest hash | `0xc53b42bbccb4c1067b88b0838fdfa1e621a9cdf3ef6509b25d6e0215c3548919` |
| Event Stellar TX | `6c30a12bece551b1a74481eced1b44299e0dc1b4eaca5a19be4850b8e59dd191` |
| Explorer | https://explorer-test.avax.network/c-chain/tx/0xbc3612b0e87711d045f1886a384507969c416c984e340ee2a09ffc916e14dab3 |

A read-only verification against Fuji confirmed chain ID `43113`, a successful receipt to the
configured registry, exactly one `ManifestAnchored` event, matching event arguments, and matching
`getAnchor(manifestHash)` storage. Source verification of the deployed contract has not been
performed yet.

### Diagnostic history

An earlier diagnostic payment (`8e37bf4a42475970a914861457b6c1c611456a42971bcc851abcbe9f2fb41fa6`,
memo `PD-A9D3DCD5`) exposed Horizon's real HAL shape (`_embedded.records`). It is not the final
ProofDrop record. The parser was corrected and the final evidence above was produced afterward.

## Current deployment status

| Area | Status |
|------|--------|
| Web homepage | Live at <https://proof-drop.netlify.app> |
| API health | Live at <https://proofdrop.onrender.com/health>; reports mode and adapter readiness without secrets |
| Pollar Google redirect | Configured for the deployed web origin |
| Browser mutation proxy | Fixed; `POST` mutations through `/api/proxy/*` reach the API with the server-side secret |
| Public record URLs | May return `404` after a Render restart, because records live in memory |

The deployed API uses the same adapters, the same canonical manifest, and the same trust rules as
the captured run above. It is configured for Stellar Testnet and Avalanche Fuji, but each run
produces its own identifiers and its own manifest hash, so the values in the previous section do not
transfer to it.

## Still required for production evidence

Completed work is listed first so it is not re-read as pending.

### Completed

| Item | Where it is visible |
|------|---------------------|
| `AnchorRegistry` deployed on Avalanche Fuji C-Chain | `0xf935193b98c53c25df88246f2a2fa78931a07d12`, deployment block `58693412` |
| Real classic USDC `Payment` submitted with the exact request memo | Stellar settlement table above |
| Receipt, decoded event, and `getAnchor` getter independently cross-checked | Avalanche anchor table above |
| Server-only `API_MUTATION_SECRET` set on both the API and the web proxy | Render and Netlify environment settings |
| Pollar Google redirect configured for the deployed web origin | Pollar dashboard |
| Browser mutation proxy reaching the API | Current deployment |

### Still required

1. Verify the deployed `AnchorRegistry` source against the compiled artifact. Only a read-only
   verification has been performed.
2. Replace the in-memory repository with the `infra/postgres` schema so a public proof URL survives
   a restart.
3. Persist Horizon's transaction response or selected fields alongside the request record.
4. Operate the public API with durable identity, access control, rate limits, observability, and
   availability controls.
5. Add an authorized deployer/anchorer policy to the permissionless registry, or explicitly accept
   the race between competing hashes.
6. Add an operational reconciliation path for a crash after Fuji submission but before the receipt
   is saved.
7. Commission a scoped security review. No audit is claimed by this MVP.
