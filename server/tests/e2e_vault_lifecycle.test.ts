import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

// Node 20+ includes standard globalThis.crypto.subtle
describe('E2E Lifecycle: Zero-Knowledge Encryption, Storage Inspection & Account Recovery', () => {
  beforeAll(async () => {
    process.env.DB_SQLITE_PATH = './data/test_e2e_lifecycle.json';
    await db.init();
  });

  const subtle = globalThis.crypto.subtle;

  // Crypto helpers mirroring client
  const hexToBuf = (hex: string) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  };

  const bufToHex = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const bufToBase64 = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return Buffer.from(bytes).toString('base64');
  };

  const base64ToBuf = (b64: string) => {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  };

  const deriveAuthHash = async (pwd: string, saltHex: string) => {
    const enc = new TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBuf(saltHex) as unknown as BufferSource, iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    return bufToHex(bits);
  };

  const deriveVaultKey = async (pwd: string, saltHex: string) => {
    const enc = new TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveKey']);
    return await subtle.deriveKey(
      { name: 'PBKDF2', salt: hexToBuf(saltHex) as unknown as BufferSource, iterations: 310000, hash: 'SHA-256' },
      key,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  };

  const encryptData = async (text: string, cryptoKey: CryptoKey) => {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      cryptoKey,
      enc.encode(text)
    );
    return {
      ciphertext: bufToBase64(ct),
      iv: bufToBase64(iv),
    };
  };

  const decryptData = async (b64Ct: string, b64Iv: string, cryptoKey: CryptoKey) => {
    const ct = base64ToBuf(b64Ct);
    const iv = base64ToBuf(b64Iv);
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      cryptoKey,
      ct as unknown as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  };

  const encryptVaultKeyWithRecovery = async (vaultKey: CryptoKey, recoveryKeyString: string) => {
    const cleanKey = recoveryKeyString.replace(/-/g, '').toUpperCase();
    const enc = new TextEncoder();
    const hashBuffer = await subtle.digest('SHA-256', enc.encode(cleanKey));
    const recoveryCryptoKey = await subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const exportedVaultKeyRaw = await subtle.exportKey('raw', vaultKey);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      recoveryCryptoKey,
      exportedVaultKeyRaw
    );
    return { ciphertext: bufToBase64(ct), iv: bufToBase64(iv) };
  };

  const decryptVaultKeyWithRecovery = async (payload: { ciphertext: string; iv: string }, recoveryKeyString: string) => {
    const cleanKey = recoveryKeyString.replace(/-/g, '').toUpperCase();
    const enc = new TextEncoder();
    const hashBuffer = await subtle.digest('SHA-256', enc.encode(cleanKey));
    const recoveryCryptoKey = await subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
    const rawVaultKey = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuf(payload.iv) as unknown as BufferSource, tagLength: 128 },
      recoveryCryptoKey,
      base64ToBuf(payload.ciphertext) as unknown as BufferSource
    );
    return await subtle.importKey('raw', rawVaultKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  };

  // Test credentials
  const email = `audited_student_${Date.now()}@securevault.local`;
  const masterPassword = 'MasterPassword#2026!UltraSafe';
  const initialRecoveryKey = 'ABCD-1234-EFGH-5678-IJKL-9012-MNOP-3456';
  let sessionCookie: string = '';
  let authSalt: string = '';
  let vaultSalt: string = '';
  let clientVaultKey: CryptoKey;
  let createdItemId: string = '';

  const secretPlaintext = {
    service: 'Banque Nationale de France',
    username: 'mon_identifiant_bancaire_458',
    password: 'SuperP@ssw0rdBanque99#',
    url: 'https://mabanque.bnf.fr',
    notes: 'Code secret de la carte : 4821',
  };

  it('Step 1: Salts Request & Zero-Knowledge Registration', async () => {
    // 1. Request salts
    const saltsRes = await request(app).post('/api/auth/salts').send({ email });
    expect(saltsRes.status).toBe(200);
    authSalt = saltsRes.body.auth_salt;
    vaultSalt = saltsRes.body.vault_salt;

    // 2. Client derives keys in browser memory
    const authHash = await deriveAuthHash(masterPassword, authSalt);
    clientVaultKey = await deriveVaultKey(masterPassword, vaultSalt);

    // 3. Encrypt vault key with emergency recovery key
    const encRecovery = await encryptVaultKeyWithRecovery(clientVaultKey, initialRecoveryKey);

    // 4. Register on server
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      auth_hash: authHash,
      auth_salt: authSalt,
      vault_salt: vaultSalt,
      recovery_encrypted_vault_key: encRecovery.ciphertext,
      recovery_key_iv: encRecovery.iv,
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    sessionCookie = regRes.headers['set-cookie'][0];
  });

  it('Step 2: Add Encrypted Vault Item & Verify No Plaintext Leaves Client', async () => {
    // Encrypt service name
    const encService = await encryptData(secretPlaintext.service, clientVaultKey);
    // Encrypt full secret data
    const encPayload = await encryptData(JSON.stringify(secretPlaintext), clientVaultKey);

    const res = await request(app)
      .post('/api/vault')
      .set('Cookie', sessionCookie)
      .set('X-SecureVault-Client', 'true')
      .send({
        service_name_encrypted: encService.ciphertext,
        service_name_iv: encService.iv,
        category: 'banks',
        encrypted_data: encPayload.ciphertext,
        data_iv: encPayload.iv,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdItemId = res.body.item.id;

    // FORMAL ZERO-KNOWLEDGE PROOF:
    // Neither the service name, username, password, nor notes appear in plaintext in the response
    const responseString = JSON.stringify(res.body);
    expect(responseString).not.toContain(secretPlaintext.service);
    expect(responseString).not.toContain(secretPlaintext.username);
    expect(responseString).not.toContain(secretPlaintext.password);
    expect(responseString).not.toContain(secretPlaintext.notes);
  });

  it('Step 3: Database Direct Inspection — Ensure Zero Plaintext Stored in Database', async () => {
    const user = await db.findUserByEmail(email);
    expect(user).toBeDefined();

    // The user's master password is NOT in the database
    expect(user!.password_hash).not.toContain(masterPassword);

    const items = await db.getVaultItemsByUserId(user!.id);
    expect(items.length).toBe(1);

    const storedItem = items[0];
    // Plaintext secrets must NOT exist in the database record
    expect(storedItem.service_name_encrypted).not.toContain(secretPlaintext.service);
    expect(storedItem.encrypted_data).not.toContain(secretPlaintext.username);
    expect(storedItem.encrypted_data).not.toContain(secretPlaintext.password);
    expect(storedItem.encrypted_data).not.toContain(secretPlaintext.notes);
  });

  it('Step 4: Client Retrieval & Decryption in Memory', async () => {
    const res = await request(app)
      .get('/api/vault')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    const item = res.body.items[0];

    // Decrypt in memory with client vault key
    const decryptedService = await decryptData(item.service_name_encrypted, item.service_name_iv, clientVaultKey);
    const decryptedJson = await decryptData(item.encrypted_data, item.data_iv, clientVaultKey);
    const decryptedSecret = JSON.parse(decryptedJson);

    expect(decryptedService).toBe(secretPlaintext.service);
    expect(decryptedSecret.username).toBe(secretPlaintext.username);
    expect(decryptedSecret.password).toBe(secretPlaintext.password);
    expect(decryptedSecret.notes).toBe(secretPlaintext.notes);
  });

  it('Step 5: Tamper Resilience — Altering ciphertext triggers AEAD tag failure', async () => {
    const res = await request(app).get('/api/vault').set('Cookie', sessionCookie);
    const item = res.body.items[0];

    // Corrupt one byte of ciphertext
    const rawCt = base64ToBuf(item.encrypted_data);
    rawCt[2] ^= 0x5a;
    const corruptedBase64 = bufToBase64(rawCt);

    // Attempting to decrypt must reject immediately
    await expect(
      decryptData(corruptedBase64, item.data_iv, clientVaultKey)
    ).rejects.toThrow();
  });

  it('Step 6: Audit Log Recording — Confirms Events Are Recorded Without Secrets', async () => {
    const res = await request(app)
      .get('/api/audit/logs')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);

    // Check that none of the log details contain passwords
    for (const log of res.body.logs) {
      expect(log.details).not.toContain(secretPlaintext.password);
      expect(log.details).not.toContain(masterPassword);
    }
  });

  it('Step 7: Account Recovery with Emergency Key — Decrypts & Re-encrypts Vault Items', async () => {
    // 1. User forgets password, requests salts and encrypted items
    const saltsRes = await request(app).post('/api/auth/salts').send({ email });
    expect(saltsRes.status).toBe(200);
    expect(saltsRes.body.encrypted_items.length).toBe(1);

    // 2. Decrypt existing vault key using emergency recovery key in client RAM
    const recoveredKey = await decryptVaultKeyWithRecovery(
      {
        ciphertext: saltsRes.body.recovery_encrypted_vault_key,
        iv: saltsRes.body.recovery_key_iv,
      },
      initialRecoveryKey
    );

    // 3. User provides a new master password and derives new parameters
    const newMasterPassword = 'NewMasterPassword#2026!Upgraded';
    const newAuthSalt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const newVaultSalt = '09f8e7d6c5b4a3219876543210fedcba';
    const newAuthHash = await deriveAuthHash(newMasterPassword, newAuthSalt);
    const newVaultKey = await deriveVaultKey(newMasterPassword, newVaultSalt);

    // 4. Re-encrypt all items locally with the new vault key
    const reEncryptedItems = [];
    for (const item of saltsRes.body.encrypted_items) {
      const plainService = await decryptData(item.service_name_encrypted, item.service_name_iv, recoveredKey);
      const plainData = await decryptData(item.encrypted_data, item.data_iv, recoveredKey);

      const encService = await encryptData(plainService, newVaultKey);
      const encData = await encryptData(plainData, newVaultKey);

      reEncryptedItems.push({
        id: item.id,
        service_name_encrypted: encService.ciphertext,
        service_name_iv: encService.iv,
        category: item.category,
        encrypted_data: encData.ciphertext,
        data_iv: encData.iv,
      });
    }

    const newRecoveryKey = 'WXYZ-9876-UVTS-5432-RQPO-1098-NMLK-7654';
    const newEncRecovery = await encryptVaultKeyWithRecovery(newVaultKey, newRecoveryKey);

    // 5. Send recovery payload
    const recoverRes = await request(app).post('/api/auth/recover').send({
      email,
      new_auth_hash: newAuthHash,
      new_auth_salt: newAuthSalt,
      new_vault_salt: newVaultSalt,
      new_recovery_encrypted_vault_key: newEncRecovery.ciphertext,
      new_recovery_key_iv: newEncRecovery.iv,
      re_encrypted_items: reEncryptedItems,
    });

    expect(recoverRes.status).toBe(200);
    expect(recoverRes.body.success).toBe(true);

    // 6. Log in with the new master password
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      auth_hash: newAuthHash,
    });
    expect(loginRes.status).toBe(200);
    const newSessionCookie = loginRes.headers['set-cookie'][0];

    // 7. Retrieve items from vault and decrypt with newVaultKey
    const listRes = await request(app).get('/api/vault').set('Cookie', newSessionCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBe(1);

    const recoveredItem = listRes.body.items[0];
    const decryptedService = await decryptData(recoveredItem.service_name_encrypted, recoveredItem.service_name_iv, newVaultKey);
    const decryptedJson = await decryptData(recoveredItem.encrypted_data, recoveredItem.data_iv, newVaultKey);
    const decryptedSecret = JSON.parse(decryptedJson);

    expect(decryptedService).toBe(secretPlaintext.service);
    expect(decryptedSecret.username).toBe(secretPlaintext.username);
    expect(decryptedSecret.password).toBe(secretPlaintext.password);
    expect(decryptedSecret.notes).toBe(secretPlaintext.notes);

    // Update sessionCookie for the deletion test
    sessionCookie = newSessionCookie;
  });

  it('Step 8: Item Deletion', async () => {
    const delRes = await request(app)
      .delete(`/api/vault/${createdItemId}`)
      .set('Cookie', sessionCookie)
      .set('X-SecureVault-Client', 'true');

    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/vault').set('Cookie', sessionCookie);
    expect(listRes.body.items.length).toBe(0);
  });
});
