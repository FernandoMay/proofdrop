export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "INVALID_STATE", message);
  }
}

export class AdapterUnconfiguredError extends AppError {
  constructor(message: string) {
    super(503, "ADAPTER_UNCONFIGURED", message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string) {
    super(502, "EXTERNAL_SERVICE_ERROR", message);
  }
}

export class EvidenceVerificationError extends AppError {
  constructor(message: string) {
    super(422, "EVIDENCE_MISMATCH", message);
  }
}
