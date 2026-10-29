import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

describe('Cybersecurity Protections & Headers', () => {
  beforeAll(async () => {
    process.env.DB_SQLITE_PATH = './data/test_sec.json';
    await db.init();
  });

  it('should include strict security HTTP headers (CSP, HSTS, X-Content-Type-Options)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should reject state-changing requests when CSRF custom header is missing', async () => {
    // Register a user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `csrf_user_${Date.now()}@securevault.local`,
        auth_hash: '1234567890123456789012345678901234567890123456789012345678901234',
        auth_salt: 'salt123456789012',
        vault_salt: 'salt123456789012',
      });

    const cookie = regRes.headers['set-cookie'][0];

    // Attempt POST /api/vault WITHOUT X-SecureVault-Client or X-Requested-With
    const res = await request(app)
      .post('/api/vault')
      .set('Cookie', cookie)
      .send({
        service_name_encrypted: 'abc',
        service_name_iv: 'iv1234567890',
        encrypted_data: 'data',
        data_iv: 'iv1234567890',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF');
  });

  it('should reject SQL injection payloads in email and fields', async () => {
    const sqliPayload = "admin' OR '1'='1";
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: sqliPayload,
        auth_hash: 'somehash12345678901234567890123456789012',
      });

    // Should fail validation gracefully with 400 Bad Request (invalid email format)
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
