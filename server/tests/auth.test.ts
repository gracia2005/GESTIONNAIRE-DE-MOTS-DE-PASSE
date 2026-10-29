import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

describe('Authentication & Zero-Knowledge Verification', () => {
  beforeAll(async () => {
    process.env.DB_SQLITE_PATH = './data/test_auth.json';
    await db.init();
  });

  const testEmail = `student_${Date.now()}@securevault.local`;
  const dummyAuthHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const dummyAuthSalt = '11223344556677889900aabbccddeeff';
  const dummyVaultSalt = 'ffeeddccbbaa00998877665544332211';
  let sessionCookie: string = '';

  it('should return pseudo-salts for unregistered email (preventing user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/salts')
      .send({ email: 'unknown_account_xyz@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exists).toBe(false);
    expect(res.body.auth_salt).toBeDefined();
    expect(res.body.vault_salt).toBeDefined();
  });

  it('should register a new user with client-side derived auth_hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        auth_hash: dummyAuthHash,
        auth_salt: dummyAuthSalt,
        vault_salt: dummyVaultSalt,
        recovery_encrypted_vault_key: 'enc_recovery_blob_sample',
        recovery_key_iv: 'iv_recovery_sample_12',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.password_hash).toBeUndefined(); // Never expose password_hash in response!

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    if (cookies) {
      sessionCookie = Array.isArray(cookies) ? cookies[0] : cookies;
      expect(sessionCookie).toContain('session_id=');
      expect(sessionCookie.toLowerCase()).toContain('httponly');
    }
  });

  it('should reject registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        auth_hash: dummyAuthHash,
        auth_salt: dummyAuthSalt,
        vault_salt: dummyVaultSalt,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return exact stored salts for registered user', async () => {
    const res = await request(app)
      .post('/api/auth/salts')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.auth_salt).toBe(dummyAuthSalt);
    expect(res.body.vault_salt).toBe(dummyVaultSalt);
  });

  it('should fail login with wrong auth_hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        auth_hash: 'wrong_hash_000000000000000000000000000000000000000000000000000000000000',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should successfully log in with valid auth_hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        auth_hash: dummyAuthHash,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.vault_salt).toBe(dummyVaultSalt);
  });

  it('should access /api/auth/me with session cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject access to /api/auth/me without session cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
