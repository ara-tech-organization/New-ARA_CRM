import crypto from 'crypto';

// Verify Meta webhook payload against the X-Hub-Signature-256 header.
// Must be called with the *raw* request body buffer — express.json() re-serialization
// will not produce the same HMAC input Meta signed.
export const verifyWebhookSignature = (rawBody, headerSignature, appSecret) => {
  if (!rawBody || !headerSignature || !appSecret) return false;

  const parts = String(headerSignature).split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const received = parts[1];
  if (expected.length !== received.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex')
    );
  } catch {
    return false;
  }
};

// Raw-body capture hook for express.json({ verify }).
// Attach only to the Meta webhook route so other endpoints aren't paying the cost.
export const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) req.rawBody = buf;
};
