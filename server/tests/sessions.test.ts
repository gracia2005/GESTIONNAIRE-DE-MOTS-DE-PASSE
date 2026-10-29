import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

describe('Active Sessions Management & Revocation', () => {
  beforeAll(async () => {
    process.env.DB_SQLITE_PATH = './data/test_sessions.json';
    await db.init();
  });

  const testUser = {
    email: `sessions_user_${Date.now()}@securevault.local`,
    auth_hash: '1111111111111111111111111111111111111111111111111111111111111111',
    auth_salt: 'salt_sessions_123456',
    vault_salt: 'vsalt_sessions_123456',
  };

  let session1Cookie: string = '';
  let session2Cookie: string = '';
  let session2Id: string = '';

  it('should register and establish Session 1', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeDefined();
    session1Cookie = res.headers['set-cookie'][0];
  });

  it('should log in a second device to establish Session 2', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')
      .send({
        email: testUser.email,
        auth_hash: testUser.auth_hash,
      });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    session2Cookie = res.headers['set-cookie'][0];
  });

  it('should list all active sessions for the user and correctly tag current session', async () => {
    const res = await request(app)
      .get('/api/user/sessions')
      .set('Cookie', session1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessions).toHaveLength(2);

    const current = res.body.sessions.find((s: any) => s.is_current);
    const other = res.body.sessions.find((s: any) => !s.is_current);

    expect(current).toBeDefined();
    expect(other).toBeDefined();
    expect(current.user_agent).toContain('Chrome');
    expect(other.user_agent).toContain('iPhone');

    session2Id = other.id;
  });

  it('should allow revoking a specific remote session', async () => {
    const res = await request(app)
      .delete(`/api/user/sessions/${session2Id}`)
      .set('Cookie', session1Cookie)
      .set('X-SecureVault-Client', 'true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_current).toBe(false);

    // Verify Session 2 is now rejected
    const checkRes = await request(app)
      .get('/api/vault')
      .set('Cookie', session2Cookie);

    expect(checkRes.status).toBe(401);
  });

  it('should support revoking all other sessions in bulk', async () => {
    // Create a 3rd session
    const resLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/121.0')
      .send({
        email: testUser.email,
        auth_hash: testUser.auth_hash,
      });

    expect(resLogin.status).toBe(200);
    const session3Cookie = resLogin.headers['set-cookie'][0];

    // Verify there are 2 active sessions (Session 1 and Session 3)
    const listBefore = await request(app)
      .get('/api/user/sessions')
      .set('Cookie', session1Cookie);
    expect(listBefore.body.sessions).toHaveLength(2);

    // Revoke all other sessions from Session 1
    const revokeRes = await request(app)
      .post('/api/user/sessions/revoke-others')
      .set('Cookie', session1Cookie)
      .set('X-SecureVault-Client', 'true');

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
    expect(revokeRes.body.revoked_count).toBe(1);

    // Verify Session 3 is invalidated
    const checkS3 = await request(app)
      .get('/api/vault')
      .set('Cookie', session3Cookie);
    expect(checkS3.status).toBe(401);

    // Session 1 remains active
    const checkS1 = await request(app)
      .get('/api/vault')
      .set('Cookie', session1Cookie);
    expect(checkS1.status).toBe(200);
  });
});
