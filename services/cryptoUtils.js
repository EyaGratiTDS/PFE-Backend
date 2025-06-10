const crypto = require('crypto');

const encryptToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token for encryption');
  }

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not found in environment variables');
  }

  // S'assurer que la clé fait 32 bytes
  const key = Buffer.from(process.env.ENCRYPTION_KEY.substring(0, 64), 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
};

const decryptToken = (encryptedToken) => {
  if (!encryptedToken || typeof encryptedToken !== 'string') {
    return null;
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY not found in environment variables');
    return null;
  }

  try {
    const [ivHex, encrypted] = encryptedToken.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(process.env.ENCRYPTION_KEY.substring(0, 64), 'hex');

    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

module.exports = { encryptToken, decryptToken };