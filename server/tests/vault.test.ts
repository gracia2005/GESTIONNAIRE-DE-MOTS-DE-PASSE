import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

describe('Vault Management & User Isolation', () => {
  beforeAll(async () => {
    process.env.DB_SQLITE_PATH = './data/test_vault.json';
    await db.init();
  });

  const userA = {
    email: `usera_${Date.now()}@securevault.local`,
    auth_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    auth_salt: 'salt_a_1234567890',
    vault_salt: 'vsalt_a_123456789',
  };

  const userB = {
    email: `userb_${Date.now()}@securevault.local`,
    auth_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    auth_salt: 'salt_b_1234567890',
    vault_salt: 'vsalt_b_123456789',
  };

  let cookieUserA: string = '';
  let cookieUserB: string = '';
  let createdItemIdUserA: string = '';

  it('should register User A and User B', async () => {
    const resA = await request(app).post('/api/auth/register').send(userA);
    expect(resA.status).toBe(201);
    cookieUserA = resA.headers['set-cookie'][0];

    const resB = await request(app).post('/api/auth/register').send(userB);
    expect(resB.status).toBe(201);
    cookieUserB = resB.headers['set-cookie'][0];
  });

  it('should create an encrypted vault item for User A', async () => {
    const res = await request(app)
      .post('/api/vault')
      .set('Cookie', cookieUserA)
      .set('X-SecureVault-Client', 'true')
      .send({
        service_name_encrypted: 'dGVzdF9naXRodWJfc2VydmljZQ==', // encrypted string
        service_name_iv: 'iv_service_96bit_12b',
        category: 'work',
        encrypted_data: 'ZW5jcnlwdGVkX3BheWxvYWRfYmxvYl9leGFtcGxl', // encrypted JSON
        data_iv: 'iv_payload_96bit_12',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.item.id).toBeDefined();
    expect(res.body.item.encrypted_data).toBe('ZW5jcnlwdGVkX3BheWxvYWRfYmxvYl9leGFtcGxl');
    createdItemIdUserA = res.body.item.id;
  });

  it('should strictly isolate data: User B must NOT see User A items', async () => {
    const resB = await request(app)
      .get('/api/vault')
      .set('Cookie', cookieUserB);

    expect(resB.status).toBe(200);
    expect(resB.body.success).toBe(true);
    expect(resB.body.items.length).toBe(0); // User B has no items
  });

  it('User A should retrieve their encrypted item', async () => {
    const resA = await request(app)
      .get('/api/vault')
      .set('Cookie', cookieUserA);

    expect(resA.status).toBe(200);
    expect(resA.body.items.length).toBe(1);
    expect(resA.body.items[0].id).toBe(createdItemIdUserA);
  });

  it('User B cannot update or delete User A item', async () => {
    // Attempt update
    const updateRes = await request(app)
      .put(`/api/vault/${createdItemIdUserA}`)
      .set('Cookie', cookieUserB)
      .set('X-SecureVault-Client', 'true')
      .send({
        service_name_encrypted: 'hacked_name',
        service_name_iv: 'iv_service_96bit_12b',
        category: 'work',
        encrypted_data: 'hacked_data',
        data_iv: 'iv_payload_96bit_12',
      });

    expect(updateRes.status).toBe(404);

    // Attempt delete
    const deleteRes = await request(app)
      .delete(`/api/vault/${createdItemIdUserA}`)
      .set('Cookie', cookieUserB)
      .set('X-SecureVault-Client', 'true');

    expect(deleteRes.status).toBe(404);
  });

  it('User A can delete their item', async () => {
    const res = await request(app)
      .delete(`/api/vault/${createdItemIdUserA}`)
      .set('Cookie', cookieUserA)
      .set('X-SecureVault-Client', 'true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/vault')
      .set('Cookie', cookieUserA);
    expect(listRes.body.items.length).toBe(0);
  });
});
