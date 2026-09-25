export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number at ${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = {};

    for (const key of Object.keys(source).sort()) {
      const child = source[key];
      if (child === undefined) {
        throw new TypeError(`Undefined value at ${path}.${key}`);
      }
      result[key] = canonicalize(child, `${path}.${key}`);
    }

    return result;
  }

  throw new TypeError(`Unsupported value at ${path}`);
}

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(canonicalize(value, "$"));
}
