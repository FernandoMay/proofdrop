# Avalanche C-Chain registry

`AnchorRegistry` stores one Avalanche Fuji anchor per canonical ProofDrop manifest hash. The
contract does not verify Stellar itself; the API performs that independent check before submitting
the sequential anchor transaction.

## Local build

```bash
forge install foundry-rs/forge-std@v1.9.7 --no-commit
forge fmt --check
forge test -vvv
```

## Fuji deployment

```bash
export AVALANCHE_PRIVATE_KEY="<testnet key; never commit>"
forge script script/Deploy.s.sol:AnchorRegistryScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast
```

Copy the deployed address to `AVALANCHE_REGISTRY_ADDRESS` in the root `.env`.

## Trust boundary

- The contract accepts a 32-byte manifest hash and a 64-character hex Stellar transaction hash.
- Duplicate manifest hashes revert.
- The API waits for a receipt and verifies both `ManifestAnchored` and `getAnchor`.
- Sequentially anchoring a hash does not make the Stellar payment atomic with Avalanche.
- The minimal registry is permissionless. A production deployment should restrict the API's anchor
  account or otherwise define an authorized-submitter policy.
- Forge was not available in the implementation environment, so source and configuration are
  provided but no passing Foundry result is claimed.
