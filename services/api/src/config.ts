import { isEvmAddress, isStellarAccountId, type ExecutionMode, type StellarAsset } from "@proofdrop/shared";

export interface ApiConfig {
  host: string;
  port: number;
  webOrigin: string;
  mutationSecret: string | null;
}

export interface StellarConfig {
  network: "testnet";
  horizonUrl: string;
  recipientPublicKey: string | null;
  asset: StellarAsset;
}

export interface AvalancheConfig {
  network: "fuji";
  rpcUrl: string;
  privateKey: `0x${string}` | null;
  registryAddress: `0x${string}` | null;
}

export interface PollarConfig {
  adapterEnabled: false;
}

export interface AppConfig {
  mode: ExecutionMode;
  api: ApiConfig;
  stellar: StellarConfig;
  avalanche: AvalancheConfig;
  pollar: PollarConfig;
}

const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";
const DEFAULT_FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
const DEFAULT_USDC_CODE = "USDC";
const DEFAULT_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const DEMO_RECIPIENT = "SIMULATED-STELLAR-RECIPIENT";
const SUPPORTED_STELLAR_HORIZON_HOST = "horizon-testnet.stellar.org";
const SUPPORTED_STELLAR_NETWORK = "testnet" as const;
const SUPPORTED_AVALANCHE_NETWORK = "fuji" as const;

function parseMode(value: string | undefined): ExecutionMode {
  if (value === undefined || value.toLowerCase() === "true" || value === "1") return "demo";
  if (value.toLowerCase() === "false" || value === "0") return "real";
  throw new Error("DEMO_MODE must be true or false.");
}

function parseSupportedNetwork<T extends string>(value: string | undefined, supported: T, name: string): T {
  const candidate = value?.trim().toLowerCase() || supported;
  if (candidate !== supported) {
    throw new Error(`${name} must be ${supported}.`);
  }
  return supported;
}

function assertSupportedStellarHorizon(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("STELLAR_HORIZON_URL must identify the supported Stellar Testnet Horizon endpoint.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== SUPPORTED_STELLAR_HORIZON_HOST ||
    (parsed.port !== "" && parsed.port !== "443")
  ) {
    throw new Error("STELLAR_HORIZON_URL must identify the supported Stellar Testnet Horizon endpoint.");
  }
}

export function sanitizeEndpointOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function parsePort(value: string | undefined, name: string): number {
  const candidate = value?.trim();
  if (!candidate) return 4000;
  const port = Number(candidate);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return port;
}

function parseUrl(value: string | undefined, fallback: string, name: string): string {
  const candidate = value?.trim() || fallback;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function parseOptional(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate ? candidate : null;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = parseMode(environment.DEMO_MODE);
  const stellarNetwork = parseSupportedNetwork(environment.STELLAR_NETWORK, SUPPORTED_STELLAR_NETWORK, "STELLAR_NETWORK");
  const avalancheNetwork = parseSupportedNetwork(environment.AVALANCHE_NETWORK, SUPPORTED_AVALANCHE_NETWORK, "AVALANCHE_NETWORK");
  const issuer = (environment.STELLAR_USDC_ISSUER?.trim() || DEFAULT_USDC_ISSUER).toUpperCase();
  const recipient = parseOptional(environment.STELLAR_RECIPIENT_PUBLIC_KEY);
  const registryAddress = parseOptional(environment.AVALANCHE_REGISTRY_ADDRESS) as `0x${string}` | null;
  const privateKey = parseOptional(environment.AVALANCHE_PRIVATE_KEY) as `0x${string}` | null;
  const horizonUrl = parseUrl(environment.STELLAR_HORIZON_URL, DEFAULT_HORIZON_URL, "STELLAR_HORIZON_URL");
  const rpcUrl = parseUrl(environment.AVALANCHE_RPC_URL, DEFAULT_FUJI_RPC_URL, "AVALANCHE_RPC_URL");

  if (mode === "real") {
    assertSupportedStellarHorizon(horizonUrl);
  }

  if (!isStellarAccountId(issuer)) {
    throw new Error("STELLAR_USDC_ISSUER must be a valid Stellar account ID.");
  }
  if (recipient !== null && !isStellarAccountId(recipient)) {
    throw new Error("STELLAR_RECIPIENT_PUBLIC_KEY must be a valid Stellar account ID.");
  }
  if (registryAddress !== null && !isEvmAddress(registryAddress)) {
    throw new Error("AVALANCHE_REGISTRY_ADDRESS must be a valid EVM address.");
  }
  if (privateKey !== null && !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("AVALANCHE_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value.");
  }

  const apiPortValue = environment.API_PORT?.trim();
  const renderPortValue = environment.PORT?.trim();
  const portValue = apiPortValue || renderPortValue;
  const portName = apiPortValue ? "API_PORT" : portValue ? "PORT" : "API_PORT";
  const renderIndicator = environment.RENDER?.trim().toLowerCase();
  const isRenderEnvironment = Boolean(renderPortValue) || renderIndicator === "true" || renderIndicator === "1";
  const hostOverride = environment.API_HOST?.trim() || environment.HOST?.trim();
  const host = hostOverride || (isRenderEnvironment ? "0.0.0.0" : "127.0.0.1");

  return {
    mode,
    api: {
      host,
      port: parsePort(portValue, portName),
      webOrigin: environment.WEB_ORIGIN?.trim() || "http://localhost:3000",
      mutationSecret: parseOptional(environment.API_MUTATION_SECRET),
    },
    stellar: {
      network: stellarNetwork,
      horizonUrl,
      recipientPublicKey: mode === "demo" ? DEMO_RECIPIENT : recipient,
      asset: {
        network: mode === "demo" ? "SIMULATED" : "Stellar Testnet",
        type: "classic",
        code: (environment.STELLAR_USDC_CODE?.trim() || DEFAULT_USDC_CODE).toUpperCase(),
        issuer,
      },
    },
    avalanche: {
      network: avalancheNetwork,
      rpcUrl,
      privateKey,
      registryAddress,
    },
    pollar: { adapterEnabled: false },
  };
}

export function adapterReadiness(config: AppConfig): {
  stellar: "simulated" | "configured" | "unconfigured";
  avalanche: "simulated" | "configured" | "unconfigured";
  pollar: "unconfigured";
} {
  return {
    stellar:
      config.mode === "demo"
        ? "simulated"
        : config.stellar.asset.network === "Stellar Testnet" && config.stellar.recipientPublicKey
          ? "configured"
          : "unconfigured",
    avalanche:
      config.mode === "demo"
        ? "simulated"
        : config.avalanche.network === "fuji" && config.avalanche.privateKey && config.avalanche.registryAddress
          ? "configured"
          : "unconfigured",
    pollar: "unconfigured",
  };
}
