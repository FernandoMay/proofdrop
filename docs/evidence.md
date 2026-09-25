# Evidence and trust boundaries

## Evidence ladder

| Artifact | Establishes | Does not establish |
|----------|--------------|--------------------|
| Stellar transaction hash | Identifies a transaction document at Horizon | Successful execution or the requested asset/amount by itself |
| Horizon payment evidence | Successful ledger transaction containing the exact classic USDC Payment operation | Avalanche anchoring or atomicity |
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

No hackathon-specific Pollar API contract is known. The implementation does not call, infer, or
simulate Pollar. `DisabledPollarAdapter` is the only boundary and reports `unconfigured`.

## Still required for production evidence

1. Deploy `AnchorRegistry` on Avalanche Fuji and verify the deployment source and address.
2. Use a dedicated Stellar Testnet recipient and sender with USDC trustlines.
3. Submit a real classic USDC Payment with the exact request memo.
4. Preserve Horizon's transaction response or selected fields in durable PostgreSQL storage.
5. Run the viem adapter and retain its independently checked receipt/event/getter evidence.
6. Operate the public API with durable identity, access control, rate limits, observability, and
   availability controls.
7. Configure a server-only `API_MUTATION_SECRET` and protect real evidence-changing routes; never
   place that secret in browser code.
8. Commission a scoped security review. No audit is claimed by this MVP.
