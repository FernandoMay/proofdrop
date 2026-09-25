import { timingSafeEqual } from "node:crypto";

import cors from "@fastify/cors";
import {
  AppError,
  createProofDropSchema,
  publicIdSchema,
  verifyPaymentSchema,
  type CreateProofDropInput,
  type ZodType,
} from "@proofdrop/shared";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import { FujiAvalancheAnchorAdapter, type AvalancheAnchorAdapter } from "./adapters/avalanche.js";
import { HorizonStellarPaymentAdapter, type StellarPaymentAdapter } from "./adapters/stellar.js";
import { adapterReadiness, loadConfig, type AppConfig } from "./config.js";
import { InMemoryProofDropRepository } from "./repository/in-memory-proof-drop-repository.js";
import type { ProofDropRepository } from "./repository/proof-drop-repository.js";
import { ProofDropService, type Clock, type IdGenerator } from "./service/proof-drop-service.js";

export interface BuildAppOptions {
  config?: AppConfig;
  repository?: ProofDropRepository;
  stellarAdapter?: StellarPaymentAdapter;
  avalancheAdapter?: AvalancheAnchorAdapter;
  clock?: Clock;
  generateId?: IdGenerator;
  logger?: FastifyServerOptions["logger"];
  fetchImplementation?: typeof fetch;
}

function isInvalidMediaTypeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  return code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" || statusCode === 415;
}

function safeMediaType(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  const mediaType = candidate.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType) ? mediaType : null;
}

function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The request body is invalid.",
      parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return parsed.data;
}

const createBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "amount"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 120 },
    description: { type: "string", maxLength: 1000, default: "" },
    amount: { type: "string", minLength: 1, maxLength: 32 },
  },
} as const;

const verifyBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transactionHash: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const paramsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["publicId"],
  properties: { publicId: { type: "string", minLength: 5, maxLength: 128 } },
} as const;

const anchorParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["proofId"],
  properties: { proofId: { type: "string", minLength: 5, maxLength: 128 } },
} as const;

function validatePublicId(value: string): string {
  return parseInput(publicIdSchema, value);
}

const MUTATION_SECRET_HEADER = "x-proofdrop-mutation-secret";

function requireMutationAuthorization(config: AppConfig, request: { headers: Record<string, unknown> }): void {
  if (config.mode === "demo") return;
  const expected = config.api.mutationSecret;
  if (!expected) {
    throw new AppError(
      503,
      "MUTATION_AUTH_UNCONFIGURED",
      "Real mode mutations require API_MUTATION_SECRET on the server.",
    );
  }

  const provided = request.headers[MUTATION_SECRET_HEADER];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (typeof value !== "string" || !secretMatches(value, expected)) {
    throw new AppError(401, "MUTATION_AUTH_REQUIRED", "A valid server-side mutation secret is required.");
  }
}

function secretMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const repository = options.repository ?? new InMemoryProofDropRepository();
  const stellarAdapter =
    options.stellarAdapter ??
    new HorizonStellarPaymentAdapter(config, options.fetchImplementation ?? fetch);
  const avalancheAdapter = options.avalancheAdapter ?? new FujiAvalancheAnchorAdapter(config);
  const service = new ProofDropService({
    config,
    repository,
    stellarAdapter,
    avalancheAdapter,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.generateId ? { generateId: options.generateId } : {}),
  });

  const app = Fastify({ logger: options.logger ?? false });
  void app.register(cors, { origin: config.api.webOrigin, methods: ["GET", "POST", "OPTIONS"] });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const payload: { error: { code: string; message: string; details?: unknown } } = {
        error: { code: error.code, message: error.message },
      };
      if (error.details !== undefined) payload.error.details = error.details;
      return reply.status(error.statusCode).send(payload);
    }

    if (isInvalidMediaTypeError(error)) {
      return reply.status(415).send({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Unsupported Media Type. Send JSON with Content-Type application/json.",
          details: {
            frameworkCode: "FST_ERR_CTP_INVALID_MEDIA_TYPE",
            contentType: safeMediaType(request.headers["content-type"]),
            supportedContentType: "application/json",
          },
        },
      });
    }

    if (typeof error === "object" && error !== null && "validation" in error && error.validation) {
      const validationError = error as { validation: unknown };
      const details = Array.isArray(validationError.validation)
        ? validationError.validation.map((issue) => {
            if (typeof issue !== "object" || issue === null) return { message: String(issue) };
            const record = issue as Record<string, unknown>;
            return {
              path: typeof record.instancePath === "string" ? record.instancePath : "",
              message: typeof record.message === "string" ? record.message : "Invalid value.",
            };
          })
        : [];
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request body is invalid.",
          details,
        },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} was not found.` },
    }),
  );

  app.get("/health", async () => ({
    data: {
      status: "ok",
      mode: config.mode,
      adapters: adapterReadiness(config),
      timestamp: new Date().toISOString(),
    },
  }));

  app.get("/api/v1/proof-drops", async (request) => {
    const query = request.query as { limit?: string };
    const parsedLimit = Number(query.limit ?? "20");
    const limit = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100 ? parsedLimit : 20;
    return { data: await service.listDrops(limit) };
  });

  app.post("/api/v1/proof-drops", { schema: { body: createBodySchema } }, async (request, reply) => {
    const input: CreateProofDropInput = parseInput(createProofDropSchema, request.body);
    const drop = await service.createDrop(input);
    return reply.status(201).send({ data: drop });
  });

  app.get("/api/v1/proof-drops/:publicId", { schema: { params: paramsSchema } }, async (request) => {
    const { publicId } = request.params as { publicId: string };
    return { data: await service.getDrop(validatePublicId(publicId)) };
  });

  app.post(
    "/api/v1/proof-drops/:publicId/verify-payment",
    { schema: { params: paramsSchema, body: verifyBodySchema } },
    async (request) => {
      requireMutationAuthorization(config, request);
      const { publicId } = request.params as { publicId: string };
      const body = parseInput(verifyPaymentSchema, request.body ?? {});
      return { data: await service.verifyPayment(validatePublicId(publicId), body.transactionHash ?? null) };
    },
  );

  app.post("/api/v1/proof-drops/:publicId/proof", { schema: { params: paramsSchema } }, async (request) => {
    requireMutationAuthorization(config, request);
    const { publicId } = request.params as { publicId: string };
    return { data: await service.createProof(validatePublicId(publicId)) };
  });

  app.post(
    "/api/v1/proofs/:proofId/anchor",
    { schema: { params: anchorParamsSchema } },
    async (request) => {
      requireMutationAuthorization(config, request);
      const { proofId } = request.params as { proofId: string };
      return { data: await service.anchorProof(validatePublicId(proofId)) };
    },
  );

  app.get("/api/v1/proofs/:publicId", { schema: { params: paramsSchema } }, async (request) => {
    const { publicId } = request.params as { publicId: string };
    return { data: await service.getProof(validatePublicId(publicId)) };
  });

  return app;
}
