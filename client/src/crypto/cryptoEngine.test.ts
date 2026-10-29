import { describe, it, expect } from 'vitest';
import { CryptoEngine } from './cryptoEngine.js';

describe('Client CryptoEngine Unit Tests', () => {
  const masterPassword = 'MySuperSecretMasterPassword2026!#';
  const authSalt = '0123456789abcdef0123456789abcdef';
  const vaultSalt = 'fedcba9876543210fedcba9876543210';

  it('should derive consistent auth_hash for identical inputs', async () => {
    const hash1 = await CryptoEngine.deriveAuthHash(masterPassword, authSalt);
    const hash2 = await CryptoEngine.deriveAuthHash(masterPassword, authSalt);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // 256 bits = 64 hex chars
  });

  it('should derive different auth_hashes for different passwords or salts', async () => {
    const hash1 = await CryptoEngine.deriveAuthHash(masterPassword, authSalt);
    const hash2 = await CryptoEngine.deriveAuthHash('DifferentPassword123!', authSalt);
    const hash3 = await CryptoEngine.deriveAuthHash(masterPassword, '99999999999999999999999999999999');

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('should derive a valid AES-GCM CryptoKey for vault encryption', async () => {
    const vaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);
    expect(vaultKey).toBeDefined();
    expect(vaultKey.algorithm.name).toBe('AES-GCM');
  });

  it('should encrypt and decrypt a plaintext string with AES-256-GCM', async () => {
    const vaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);
    const message = 'Confidential Bank Account Credentials';

    const encrypted = await CryptoEngine.encryptString(message, vaultKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toContain(message); // No plaintext leak

    const decrypted = await CryptoEngine.decryptString(encrypted, vaultKey);
    expect(decrypted).toBe(message);
  });

  it('should fail decryption if ciphertext has been tampered with (AEAD Tag Check)', async () => {
    const vaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);
    const encrypted = await CryptoEngine.encryptString('Sensitive Data', vaultKey);

    // Tamper with ciphertext by corrupting a character
    const rawBuffer = CryptoEngine.base64ToBuffer(encrypted.ciphertext);
    rawBuffer[0] ^= 0xff; // flip bits
    const tamperedCiphertext = CryptoEngine.bufferToBase64(rawBuffer);

    await expect(
      CryptoEngine.decryptString({ ciphertext: tamperedCiphertext, iv: encrypted.iv }, vaultKey)
    ).rejects.toThrow();
  });

  it('should encrypt and decrypt full VaultSecretData structure', async () => {
    const vaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);
    const secret = {
      username: 'alice_admin',
      password: 'ComplexP@ssw0rd!#2026',
      url: 'https://vault.company.internal',
      notes: 'Contains confidential SSH tokens',
    };

    const encrypted = await CryptoEngine.encryptVaultData(secret, vaultKey);
    expect(encrypted.ciphertext).not.toContain('alice_admin');
    expect(encrypted.ciphertext).not.toContain('ComplexP@ssw0rd!#2026');

    const decrypted = await CryptoEngine.decryptVaultData(encrypted, vaultKey);
    expect(decrypted).toEqual(secret);
  });

  it('should generate an Emergency Recovery Key and recover the vault key', async () => {
    const vaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);
    const recoveryKey = CryptoEngine.generateRecoveryKey();

    expect(recoveryKey.length).toBe(39); // 32 chars + 7 hyphens
    expect(recoveryKey).toMatch(/^[2-9A-Z]{4}(-[2-9A-Z]{4}){7}$/);

    const encryptedVaultKeyPayload = await CryptoEngine.encryptVaultKeyWithRecovery(vaultKey, recoveryKey);
    const recoveredVaultKey = await CryptoEngine.decryptVaultKeyWithRecovery(encryptedVaultKeyPayload, recoveryKey);

    // Verify recovered key can decrypt data that was encrypted with the original key
    const testSecret = { username: 'recovery_test', password: 'SecretPassword99!' };
    const encryptedSecret = await CryptoEngine.encryptVaultData(testSecret, vaultKey);
    const decryptedSecret = await CryptoEngine.decryptVaultData(encryptedSecret, recoveredVaultKey);

    expect(decryptedSecret).toEqual(testSecret);
  });

  it('CSPRNG password generator should obey length and option constraints', () => {
    const pwd1 = CryptoEngine.generatePassword({
      length: 24,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true,
      excludeAmbiguous: false,
    });

    expect(pwd1.length).toBe(24);
    expect(/[A-Z]/.test(pwd1)).toBe(true);
    expect(/[a-z]/.test(pwd1)).toBe(true);
    expect(/[0-9]/.test(pwd1)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(pwd1)).toBe(true);

    // Exclude ambiguous test
    const pwdClean = CryptoEngine.generatePassword({
      length: 30,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: false,
      excludeAmbiguous: true,
    });
    // Should not contain 'l', '1', 'I', 'O', '0'
    expect(/[l1IO0]/.test(pwdClean)).toBe(false);
  });

  it('Password strength evaluation should score weak and strong passwords properly', () => {
    const weak = CryptoEngine.evaluatePasswordStrength('123456');
    expect(weak.score).toBeLessThan(30);
    expect(weak.label).toBe('Très faible');

    const strong = CryptoEngine.evaluatePasswordStrength('P@ssw0rd_Sup3r_S3cur3_2026!');
    expect(strong.score).toBeGreaterThanOrEqual(80);
    expect(['Fort', 'Excellent']).toContain(strong.label);
  });

  it('should decode Base32 and generate exact RFC 6238 TOTP codes', async () => {
    // RFC 6238 Test Vector:
    // Secret = "12345678901234567890" -> Base32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    // Test at timestamp 59 (Time step 1) -> Expected TOTP: "287082"
    const totp1 = await CryptoEngine.generateTOTP(rfcSecret, 59);
    expect(totp1.code).toBe('287082');
    expect(totp1.secondsRemaining).toBe(1);

    // Test at timestamp 1111111109 (Time step 37037036) -> Expected TOTP: "081804"
    const totp2 = await CryptoEngine.generateTOTP(rfcSecret, 1111111109);
    expect(totp2.code).toBe('081804');

    // Test otpauth:// URI parsing
    const uri = 'otpauth://totp/GitHub:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub';
    const totpFromUri = await CryptoEngine.generateTOTP(uri, 59);
    expect(totpFromUri.code).toBe('287082');
  });

  it('should generate high-entropy Passphrases (NIST Diceware)', () => {
    const passphrase = CryptoEngine.generatePassphrase({
      wordCount: 5,
      separator: '-',
      capitalize: true,
      includeNumber: true,
    });

    const parts = passphrase.split('-');
    expect(parts.length).toBe(6); // 5 words + 1 number
    expect(parts[0][0]).toBe(parts[0][0].toUpperCase()); // Capitalized
    expect(/^\d{2}$/.test(parts[5])).toBe(true); // 2-digit number at the end
  });
});
