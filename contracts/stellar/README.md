# Stellar contract boundary

The MVP does **not** require a Soroban contract on Stellar Testnet.

A classic USDC `Payment` transaction, its ledger inclusion, asset fields, recipient, amount, and
memo are sufficient for the independent Horizon verification implemented by the API. Publishing a
registry contract on Stellar would add a deployment and trust boundary without improving that
verification step for this MVP.

If a later release needs an on-Stellar registry, implement it as a separate versioned adapter. Do
not represent the current off-chain manifest hash as a Stellar contract state.
