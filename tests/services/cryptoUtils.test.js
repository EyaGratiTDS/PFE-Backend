const cryptoUtils = require('../../services/cryptoUtils');

describe('CryptoUtils Service', () => {
  const testToken = 'test-jwt-token-1234567890';
  const validEncryptionKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
    process.env.ENCRYPTION_KEY = validEncryptionKey;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encryptToken', () => {
    test('should encrypt token successfully', () => {
      const encryptedToken = cryptoUtils.encryptToken(testToken);
      expect(encryptedToken).toBeDefined();
      expect(typeof encryptedToken).toBe('string');
      expect(encryptedToken).toContain(':');
      expect(encryptedToken).not.toBe(testToken);
    });

    test('should generate different encrypted values for same token', () => {
      const encrypted1 = cryptoUtils.encryptToken(testToken);
      const encrypted2 = cryptoUtils.encryptToken(testToken);
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should throw error for invalid token', () => {
      expect(() => cryptoUtils.encryptToken(null)).toThrow('Invalid token for encryption');
      expect(() => cryptoUtils.encryptToken(undefined)).toThrow('Invalid token for encryption');
      expect(() => cryptoUtils.encryptToken('')).toThrow('Invalid token for encryption');
      expect(() => cryptoUtils.encryptToken(123)).toThrow('Invalid token for encryption');
    });

    test('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => cryptoUtils.encryptToken(testToken)).toThrow('ENCRYPTION_KEY not found in environment variables');
    });
  });

  describe('decryptToken', () => {
    test('should decrypt encrypted token successfully', () => {
      const encryptedToken = cryptoUtils.encryptToken(testToken);
      const decryptedToken = cryptoUtils.decryptToken(encryptedToken);
      expect(decryptedToken).toBe(testToken);
    });

    test('should return null for invalid encrypted token', () => {
      expect(cryptoUtils.decryptToken(null)).toBeNull();
      expect(cryptoUtils.decryptToken(undefined)).toBeNull();
      expect(cryptoUtils.decryptToken('')).toBeNull();
      expect(cryptoUtils.decryptToken(123)).toBeNull();
    });

    test('should return null for malformed encrypted token', () => {
      expect(cryptoUtils.decryptToken('invalid-format')).toBeNull();
    });

    test('should return null for token encrypted with different key', () => {
      const encryptedToken = cryptoUtils.encryptToken(testToken);
      process.env.ENCRYPTION_KEY = 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';
      const decryptedToken = cryptoUtils.decryptToken(encryptedToken);
      expect(decryptedToken).toBeNull();
    });

    test('should handle corrupted encrypted data', () => {
      const encryptedToken = cryptoUtils.encryptToken(testToken);
      const parts = encryptedToken.split(':');
      const corruptedToken = parts[0] + ':corrupted_data';
      const decryptedToken = cryptoUtils.decryptToken(corruptedToken);
      expect(decryptedToken).toBeNull();
    });

    test('should return null when ENCRYPTION_KEY is not set during decryption', () => {
      const encryptedToken = cryptoUtils.encryptToken(testToken);
      delete process.env.ENCRYPTION_KEY;
      const decryptedToken = cryptoUtils.decryptToken(encryptedToken);
      expect(decryptedToken).toBeNull();
    });
  });
});