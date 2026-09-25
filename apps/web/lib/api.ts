import type { ProofDropView, ProofView } from "@proofdrop/shared";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const MUTATION_PROXY_PREFIX = "/api/proxy";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface ApiEnvelope<T> {
  data: T;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error?.code ?? "API_ERROR",
      payload.error?.message ?? "ProofDrop API request failed.",
    );
  }
  return payload.data;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(`${API_URL}${path}`, init);
}

export function mutationFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(`${MUTATION_PROXY_PREFIX}${path}`, {
    ...init,
    method: "POST",
    body: init?.body ?? "{}",
  });
}

export function getProofDrop(publicId: string): Promise<ProofDropView> {
  return apiFetch<ProofDropView>(`/api/v1/proof-drops/${encodeURIComponent(publicId)}`);
}

export function getProof(publicId: string): Promise<ProofView> {
  return apiFetch<ProofView>(`/api/v1/proofs/${encodeURIComponent(publicId)}`);
}

export function getRecentProofDrops(): Promise<ProofDropView[]> {
  return apiFetch<ProofDropView[]>("/api/v1/proof-drops?limit=20");
}

export function getHealth(): Promise<{
  status: string;
  mode: "demo" | "real";
  adapters: { stellar: string; avalanche: string; pollar: string };
  timestamp: string;
}> {
  return apiFetch("/health");
}
