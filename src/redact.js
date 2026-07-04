const DEFAULT_REDACT_KEYS = [
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "secret",
  "session",
  "token"
];

const SAFE_TOKEN_METRIC_KEYS = new Set([
  "cachedtokens",
  "completiontokens",
  "inputtokens",
  "outputtokens",
  "prompttokens",
  "reasoningtokens",
  "totaltokens"
]);

function normalizeKeys(keys) {
  return keys.map((key) => key.toLowerCase());
}

function canonicalKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shouldRedactKey(key, normalizedKeys) {
  const lower = key.toLowerCase();
  const canonical = canonicalKey(key);
  if (SAFE_TOKEN_METRIC_KEYS.has(canonical)) return false;
  return normalizedKeys.some((pattern) => {
    const canonicalPattern = canonicalKey(pattern);
    return lower === pattern || lower.includes(pattern) || canonical === canonicalPattern || canonical.includes(canonicalPattern);
  });
}

function redactValue(value, normalizedKeys, replacement) {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, normalizedKeys, replacement));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = shouldRedactKey(key, normalizedKeys) ? replacement : redactValue(nested, normalizedKeys, replacement);
    }
    return output;
  }

  return value;
}

export function redactTrace(trace, options = {}) {
  const keys = options.keys ?? DEFAULT_REDACT_KEYS;
  const replacement = options.replacement ?? "[REDACTED]";
  const normalizedKeys = normalizeKeys(keys);
  const redacted = redactValue(trace, normalizedKeys, replacement);

  redacted.metadata = {
    ...(redacted.metadata ?? {}),
    redacted: true,
    redactedAt: new Date().toISOString(),
    redactionKeys: keys
  };

  return redacted;
}

export function parseRedactKeys(value) {
  if (!value) return DEFAULT_REDACT_KEYS;
  return value
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export { DEFAULT_REDACT_KEYS };
