const DECIMAL_AMOUNT = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/;
const DECIMAL_PLACES = 7;

export function normalizeDecimalAmount(value: string): string {
  const normalizedInput = value.trim();
  const match = DECIMAL_AMOUNT.exec(normalizedInput);

  if (!match) {
    throw new Error("Amount must be a positive base-10 decimal with at most seven fractional digits.");
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(DECIMAL_PLACES, "0");
  const canonical = `${whole}.${fraction}`;

  if (BigInt(whole) === 0n && /^0+$/.test(fraction)) {
    throw new Error("Amount must be greater than zero.");
  }

  return canonical;
}

export function decimalAmountsEqual(left: string, right: string): boolean {
  try {
    return normalizeDecimalAmount(left) === normalizeDecimalAmount(right);
  } catch {
    return false;
  }
}
