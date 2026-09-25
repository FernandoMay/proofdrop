export interface PollarVerificationRequest {
  transactionHash: string;
  network: string;
}

export interface PollarVerificationResult {
  status: "unconfigured";
  verified: false;
  message: string;
}

export interface PollarAdapter {
  readonly enabled: false;
  verify(request: PollarVerificationRequest): Promise<PollarVerificationResult>;
}

/**
 * Pollar's hackathon-specific API contract is unknown. This boundary stays disabled
 * until an official endpoint and authentication contract are supplied and reviewed.
 */
export class DisabledPollarAdapter implements PollarAdapter {
  readonly enabled = false as const;

  async verify(_request: PollarVerificationRequest): Promise<PollarVerificationResult> {
    return {
      status: "unconfigured",
      verified: false,
      message: "Pollar adapter disabled: the hackathon-specific API contract is unknown.",
    };
  }
}
