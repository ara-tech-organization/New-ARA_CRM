// Typed errors for Meta Graph API calls.
//
// Callers (sync service, webhook handler) distinguish these to decide:
//   - MetaAuthError         → token rotation / config problem, stop the run
//   - MetaPermissionError   → client mis-configured, skip this client
//   - MetaRateLimitError    → back off and retry later
//   - MetaTransientError    → retry with backoff (5xx, network hiccups)
//   - MetaValidationError   → bad input, won't succeed on retry
//   - MetaApiError          → catch-all fallback
//
// Meta error codes reference:
//   https://developers.facebook.com/docs/graph-api/guides/error-handling
//
//   190       — invalid/expired token
//   200,10,299 — permission denied
//   4,17,32,613 — user/app rate limits
//   1,2       — unknown / transient service
//   368       — temporary block
//   100       — invalid parameter
//   803       — object does not exist

export class MetaApiError extends Error {
  constructor(message, { code, subcode, httpStatus, fbtraceId, endpoint, retryable = false } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code ?? null;
    this.subcode = subcode ?? null;
    this.httpStatus = httpStatus ?? null;
    this.fbtraceId = fbtraceId ?? null;
    this.endpoint = endpoint ?? null;
    this.retryable = retryable;
  }
}

export class MetaAuthError extends MetaApiError {
  constructor(message, meta = {}) {
    super(message, { ...meta, retryable: false });
  }
}

export class MetaPermissionError extends MetaApiError {
  constructor(message, meta = {}) {
    super(message, { ...meta, retryable: false });
  }
}

export class MetaRateLimitError extends MetaApiError {
  constructor(message, meta = {}) {
    super(message, { ...meta, retryable: true });
    this.resumeInSeconds = meta.resumeInSeconds ?? 0;
  }
}

export class MetaTransientError extends MetaApiError {
  constructor(message, meta = {}) {
    super(message, { ...meta, retryable: true });
  }
}

export class MetaValidationError extends MetaApiError {
  constructor(message, meta = {}) {
    super(message, { ...meta, retryable: false });
  }
}

// Classify Meta's error JSON into one of our typed errors.
// `payload` is the parsed body of a non-2xx response: { error: { message, code, error_subcode, ... } }
export const classifyMetaError = (httpStatus, payload, endpoint) => {
  const err = payload?.error ?? {};
  const code = typeof err.code === 'number' ? err.code : null;
  const subcode = typeof err.error_subcode === 'number' ? err.error_subcode : null;
  const message = err.message || `Meta API error (HTTP ${httpStatus})`;
  const fbtraceId = err.fbtrace_id || null;

  const base = { code, subcode, httpStatus, fbtraceId, endpoint };

  if (code === 190 || subcode === 463 || subcode === 467 || subcode === 460) {
    return new MetaAuthError(message, base);
  }
  if ([200, 10, 299, 294, 3].includes(code)) {
    return new MetaPermissionError(message, base);
  }
  if ([4, 17, 32, 613, 368].includes(code) || httpStatus === 429) {
    return new MetaRateLimitError(message, base);
  }
  if (code === 100 || code === 803 || httpStatus === 400) {
    return new MetaValidationError(message, base);
  }
  if (httpStatus >= 500 || code === 1 || code === 2) {
    return new MetaTransientError(message, base);
  }
  return new MetaApiError(message, base);
};
