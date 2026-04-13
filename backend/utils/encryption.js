import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Lazy getter — reads the key at call time (after dotenv has loaded)
// Always returns exactly 32 bytes (pads with zeros or truncates)
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }
  const buf = Buffer.alloc(32, 0);
  Buffer.from(key, 'utf-8').copy(buf, 0, 0, 32);
  return buf;
};

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text
 */
export const encrypt = (text) => {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      getEncryptionKey(),
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data
 * @param {string} text - Encrypted text
 * @returns {string} Decrypted text
 */
export const decrypt = (text) => {
  if (!text) return text;

  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      iv
    );
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash sensitive data (one-way)
 * @param {string} text - Text to hash
 * @returns {string} Hashed text
 */
export const hash = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};
