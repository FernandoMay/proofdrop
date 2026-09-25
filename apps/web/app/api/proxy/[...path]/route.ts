const PROXY_PREFIX = "/api/proxy/";
const DEFAULT_API_URL = "http://localhost:4000";
const SAFE_PATH_ID = /^[A-Za-z0-9_-]{5,128}$/;

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  extraHeaders?: HeadersInit,
): Response {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function methodNotAllowed(): Response {
  return errorResponse(
    405,
    "METHOD_NOT_ALLOWED",
    "Only POST is supported by the ProofDrop mutation proxy.",
    { allowedMethods: ["POST"] },
    { allow: "POST" },
  );
}

function getMutationPath(request: Request): string | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (url.search !== "" || url.hash !== "" || !url.pathname.startsWith(PROXY_PREFIX)) return null;

  const rawPath = url.pathname.slice(PROXY_PREFIX.length);
  if (
    rawPath.length === 0 ||
    rawPath.includes("%") ||
    rawPath.includes("\\") ||
    rawPath.includes("//")
  ) {
    return null;
  }

  const segments = rawPath.split("/");
  if (segments.length !== 5) return null;
  const [api, version, resource, id, action] = segments;
  if (api !== "api" || version !== "v1" || id === undefined || !SAFE_PATH_ID.test(id)) return null;

  const isProofDropRoute = resource === "proof-drops" && (action === "verify-payment" || action === "proof");
  const isProofRoute = resource === "proofs" && action === "anchor";
  if (!isProofDropRoute && !isProofRoute) return null;

  return `/${segments.join("/")}`;
}

function getExecutionMode(): "demo" | "real" | null {
  const value = process.env.DEMO_MODE?.trim().toLowerCase();
  if (!value || value === "true" || value === "1") return "demo";
  if (value === "false" || value === "0") return "real";
  return null;
}

function getApiBaseUrl(): URL | null {
  const candidate = process.env.API_URL?.trim() || DEFAULT_API_URL;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      parsed.pathname.includes("..")
    ) {
      return null;
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed;
  } catch {
    return null;
  }
}

function isJsonContentType(value: string): boolean {
  return value.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

async function readJsonBody(request: Request): Promise<{ body: string } | { response: Response }> {
  const contentType = request.headers.get("content-type");
  if (contentType !== null && !isJsonContentType(contentType)) {
    return {
      response: errorResponse(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Mutation requests must use application/json.",
        { contentType: contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "unknown" },
      ),
    };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { response: errorResponse(400, "INVALID_REQUEST_BODY", "The request body could not be read.") };
  }

  if (rawBody.trim() === "") return { body: "{}" };

  try {
    return { body: JSON.stringify(JSON.parse(rawBody)) as string };
  } catch {
    return { response: errorResponse(400, "INVALID_JSON", "The request body must contain valid JSON.") };
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();

  const mutationPath = getMutationPath(request);
  if (mutationPath === null) {
    return errorResponse(404, "PROXY_ROUTE_NOT_FOUND", "The requested ProofDrop mutation route is not allowed.");
  }

  const mode = getExecutionMode();
  if (mode === null) {
    return errorResponse(500, "PROXY_MODE_UNCONFIGURED", "The Next.js server has an invalid DEMO_MODE configuration.");
  }

  const baseUrl = getApiBaseUrl();
  if (baseUrl === null) {
    return errorResponse(500, "API_URL_INVALID", "The Next.js server has an invalid API_URL configuration.");
  }

  const mutationSecret = process.env.API_MUTATION_SECRET?.trim();
  if (mode === "real" && !mutationSecret) {
    return errorResponse(
      503,
      "MUTATION_AUTH_UNCONFIGURED",
      "Real mode mutations require API_MUTATION_SECRET on the Next.js server.",
    );
  }

  const parsedBody = await readJsonBody(request);
  if ("response" in parsedBody) return parsedBody.response;

  const basePath = baseUrl.pathname === "/" ? "" : baseUrl.pathname;
  const target = new URL(`${basePath}${mutationPath}`, baseUrl.origin);
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (mode === "real" && mutationSecret) headers["X-ProofDrop-Mutation-Secret"] = mutationSecret;

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: parsedBody.body,
      cache: "no-store",
      redirect: "error",
    });
    const upstreamBody = await upstream.text();
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const upstreamContentType = upstream.headers.get("content-type");
    responseHeaders.set(
      "content-type",
      upstreamContentType && isJsonContentType(upstreamContentType) ? upstreamContentType : "application/json; charset=utf-8",
    );
    const bodyless = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
    return new Response(bodyless ? null : upstreamBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse(502, "API_UNAVAILABLE", "The ProofDrop API could not be reached through the server proxy.");
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
