// Parse Meta's X-Business-Use-Case-Usage header (or x-ad-account-usage,
// x-app-usage) into a simple {bucket, percentage, resetSeconds} shape so
// callers can decide whether to throttle.
//
// Header format (JSON string):
//   {"<businessId>":[{"type":"ads_management","call_count":48,"total_cputime":12,
//                     "total_time":5,"estimated_time_to_regain_access":0}]}

const THROTTLE_THRESHOLD = 80; // percent

const parseJsonHeader = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

export const summarizeUsage = (headers = {}) => {
  const result = {
    business: parseJsonHeader(headers['x-business-use-case-usage']) || {},
    app: parseJsonHeader(headers['x-app-usage']) || {},
    adAccount: parseJsonHeader(headers['x-ad-account-usage']) || {},
    capturedAt: new Date().toISOString(),
  };
  return result;
};

// Returns { throttle: boolean, resumeInSeconds: number, worstBucket: string, worstPercent: number }
export const shouldThrottle = (usage) => {
  if (!usage) return { throttle: false, resumeInSeconds: 0, worstBucket: '', worstPercent: 0 };

  let worstPercent = 0;
  let worstBucket = '';
  let resumeInSeconds = 0;

  const checkBuckets = (label, obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [id, entries] of Object.entries(obj)) {
      const list = Array.isArray(entries) ? entries : [entries];
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const pct = Math.max(
          Number(entry.call_count) || 0,
          Number(entry.total_cputime) || 0,
          Number(entry.total_time) || 0
        );
        if (pct > worstPercent) {
          worstPercent = pct;
          worstBucket = `${label}:${id}:${entry.type || 'default'}`;
          resumeInSeconds = Number(entry.estimated_time_to_regain_access) || 0;
        }
      }
    }
  };

  checkBuckets('business', usage.business);
  checkBuckets('app', usage.app);
  checkBuckets('adAccount', usage.adAccount);

  return {
    throttle: worstPercent >= THROTTLE_THRESHOLD || resumeInSeconds > 0,
    resumeInSeconds,
    worstBucket,
    worstPercent,
  };
};

export const THROTTLE_THRESHOLD_PERCENT = THROTTLE_THRESHOLD;
