export interface PollarBoundaryStatus {
  status: "client_optional";
  authoritative: false;
  message: string;
}

export interface PollarAdapter {
  readonly enabled: false;
  readonly authoritative: false;
  status(): PollarBoundaryStatus;
}

/**
 * Pollar's official SDK is an optional browser payment rail. This server boundary
 * stays disabled and non-authoritative: the API does not call Pollar or accept its
 * responses as proof. Horizon remains the payment verifier.
 */
export class DisabledPollarAdapter implements PollarAdapter {
  readonly enabled = false as const;
  readonly authoritative = false as const;

  status(): PollarBoundaryStatus {
    return {
      status: "client_optional",
      authoritative: false,
      message:
        "Pollar is an optional browser payment rail; this API does not call it or treat its responses as proof.",
    };
  }
}
