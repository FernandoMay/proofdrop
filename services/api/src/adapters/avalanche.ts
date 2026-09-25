import {
  ExternalServiceError,
  isSimulatedAvalancheAnchorEvidence,
  isStellarTransactionHash,
  isVerifiedAvalancheAnchorEvidence,
  type AdapterResult,
  type AvalancheAnchorEvidence,
} from "@proofdrop/shared";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { avalancheFuji } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import type { AppConfig } from "../config.js";

const ANCHOR_REGISTRY_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "manifestHash", type: "bytes32" },
      { name: "stellarTxHash", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAnchor",
    stateMutability: "view",
    inputs: [{ name: "manifestHash", type: "bytes32" }],
    outputs: [
      { name: "anchorer", type: "address" },
      { name: "stellarTxHash", type: "string" },
      { name: "anchoredAt", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "ManifestAnchored",
    inputs: [
      { indexed: true, name: "manifestHash", type: "bytes32" },
      { indexed: false, name: "stellarTxHash", type: "string" },
      { indexed: true, name: "anchorer", type: "address" },
      { indexed: false, name: "anchoredAt", type: "uint64" },
    ],
  },
] as const;

export interface AnchorManifestInput {
  manifestHash: string;
  stellarTransactionHash: string;
  proofId: string;
  now: string;
}

export interface AvalancheAnchorAdapter {
  anchorManifest(input: AnchorManifestInput): Promise<AdapterResult<AvalancheAnchorEvidence>>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rpcResult(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return null;
  if (record.error !== undefined && record.error !== null) {
    throw new ExternalServiceError("Avalanche RPC returned an error while checking the network identity.");
  }
  return record.result;
}

export class FujiAvalancheAnchorAdapter implements AvalancheAnchorAdapter {
  readonly #config: AppConfig;
  readonly #fetch: typeof fetch;

  constructor(config: AppConfig, fetchImplementation: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImplementation;
  }

  async anchorManifest(input: AnchorManifestInput): Promise<AdapterResult<AvalancheAnchorEvidence>> {
    if (this.#config.mode === "demo") {
      if (isStellarTransactionHash(input.stellarTransactionHash)) {
        throw new Error("Demo anchoring must not use a real-looking Stellar transaction hash.");
      }
      const evidence: AvalancheAnchorEvidence = {
        verification: "simulated",
        network: "SIMULATED",
        contractAddress: null,
        transactionHash: null,
        blockNumber: null,
        logAddress: null,
        manifestHash: input.manifestHash,
        stellarTransactionHash: input.stellarTransactionHash,
        anchorer: null,
        anchoredAt: null,
        message: "SIMULATED: sequential demo flow only; no cross-chain transaction exists.",
      };
      if (
        !isSimulatedAvalancheAnchorEvidence(evidence, {
          manifestHash: input.manifestHash,
          stellarTransactionHash: input.stellarTransactionHash,
        })
      ) {
        throw new ExternalServiceError("Avalanche adapter produced incomplete simulated evidence.");
      }
      return {
        status: "simulated",
        message: "SIMULATED: no Avalanche transaction was submitted or queried.",
        evidence,
      };
    }

    const privateKey = this.#config.avalanche.privateKey;
    const registryAddress = this.#config.avalanche.registryAddress;
    if (
      this.#config.avalanche.network !== "fuji" ||
      !privateKey ||
      !registryAddress
    ) {
      return {
        status: "unconfigured",
        evidence: null,
        message: "Avalanche anchoring is unconfigured for a supported Fuji identity.",
      };
    }
    if (!/^[a-f0-9]{64}$/.test(input.manifestHash) || !isStellarTransactionHash(input.stellarTransactionHash)) {
      throw new Error("Real anchoring requires canonical 32-byte and Stellar transaction hashes.");
    }

    if (!(await this.#hasFujiChainId())) {
      return {
        status: "unconfigured",
        evidence: null,
        message: "The configured Avalanche RPC did not prove chain ID 43113; no Fuji evidence was accepted.",
      };
    }

    const account = privateKeyToAccount(privateKey);
    const transport = http(this.#config.avalanche.rpcUrl, { timeout: 15_000 });
    const publicClient = createPublicClient({ chain: avalancheFuji, transport });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport });
    const viemManifestHash = `0x${input.manifestHash}` as Hex;

    let transactionHash: Hex;
    let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>;
    let block: Awaited<ReturnType<typeof publicClient.getBlock>>;
    try {
      transactionHash = await walletClient.writeContract({
        address: registryAddress,
        abi: ANCHOR_REGISTRY_ABI,
        functionName: "anchor",
        args: [viemManifestHash, input.stellarTransactionHash],
        chain: avalancheFuji,
        account,
      });
      receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash, confirmations: 1 });
      block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    } catch {
      throw new ExternalServiceError("Avalanche did not accept or confirm the anchor transaction.");
    }

    if (
      receipt.status !== "success" ||
      !receipt.to ||
      receipt.from.toLowerCase() !== account.address.toLowerCase() ||
      receipt.to.toLowerCase() !== registryAddress.toLowerCase() ||
      receipt.contractAddress ||
      typeof receipt.transactionHash !== "string" ||
      receipt.transactionHash.toLowerCase() !== transactionHash.toLowerCase()
    ) {
      throw new ExternalServiceError("The Avalanche transaction receipt did not match the configured registry.");
    }

    const registryLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === registryAddress.toLowerCase(),
    );
    if (registryLogs.length !== 1) {
      throw new ExternalServiceError("The Avalanche receipt must contain exactly one registry event.");
    }
    const events = parseEventLogs({
      abi: ANCHOR_REGISTRY_ABI,
      eventName: "ManifestAnchored",
      logs: registryLogs,
      strict: true,
    });
    if (events.length !== 1) {
      throw new ExternalServiceError("The Avalanche receipt contained an unexpected registry event count.");
    }
    const event = events[0]!;
    if (
      event.address.toLowerCase() !== registryAddress.toLowerCase() ||
      event.args.manifestHash.toLowerCase() !== viemManifestHash.toLowerCase() ||
      event.args.stellarTxHash !== input.stellarTransactionHash ||
      event.args.anchorer.toLowerCase() !== account.address.toLowerCase() ||
      event.args.anchoredAt !== block.timestamp
    ) {
      throw new ExternalServiceError("The Avalanche registry event did not match the manifest and Stellar transaction.");
    }

    let onChainAnchor: readonly [string, string, bigint];
    try {
      onChainAnchor = (await publicClient.readContract({
        address: registryAddress,
        abi: ANCHOR_REGISTRY_ABI,
        functionName: "getAnchor",
        args: [viemManifestHash],
      })) as readonly [string, string, bigint];
    } catch {
      throw new ExternalServiceError("The Avalanche registry getter could not be read.");
    }
    const [anchorer, stellarTxHash, anchoredAt] = onChainAnchor;
    if (
      anchorer.toLowerCase() !== account.address.toLowerCase() ||
      stellarTxHash !== input.stellarTransactionHash ||
      anchoredAt !== event.args.anchoredAt
    ) {
      throw new ExternalServiceError("The Avalanche registry getter did not match the emitted event.");
    }

    const evidence: AvalancheAnchorEvidence = {
      verification: "verified",
      network: "Avalanche Fuji",
      contractAddress: registryAddress,
      transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      logAddress: event.address,
      manifestHash: input.manifestHash,
      stellarTransactionHash: input.stellarTransactionHash,
      anchorer,
      anchoredAt: new Date(Number(anchoredAt) * 1000).toISOString(),
      message: "Receipt, event, and getter agree.",
    };
    if (
      !isVerifiedAvalancheAnchorEvidence(evidence, {
        manifestHash: input.manifestHash,
        stellarTransactionHash: input.stellarTransactionHash,
        contractAddress: registryAddress,
      })
    ) {
      throw new ExternalServiceError("Avalanche adapter produced incomplete verified evidence.");
    }

    return {
      status: "verified",
      message: "Receipt, registry event, and getter verified after proving Avalanche Fuji chain ID 43113.",
      evidence,
    };
  }

  async #hasFujiChainId(): Promise<boolean> {
    let response: Response;
    try {
      response = await this.#fetch(this.#config.avalanche.rpcUrl, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ExternalServiceError("Avalanche RPC could not be reached for network identity verification.");
    }
    if (!response.ok) {
      throw new ExternalServiceError(`Avalanche RPC returned HTTP ${response.status} for network identity verification.`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ExternalServiceError("Avalanche RPC returned invalid JSON for network identity verification.");
    }
    const result = rpcResult(payload);
    if (typeof result !== "string" || !/^0x[0-9a-f]+$/i.test(result)) return false;
    try {
      return BigInt(result) === 43113n;
    } catch {
      return false;
    }
  }
}
