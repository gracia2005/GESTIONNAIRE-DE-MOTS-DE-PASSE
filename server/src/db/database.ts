import fs from 'fs';
import path from 'path';
import pg from 'pg';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  auth_salt: string;
  vault_salt: string;
  recovery_encrypted_vault_key?: string;
  recovery_key_iv?: string;
  auto_lock_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface VaultItemRecord {
  id: string;
  user_id: string;
  service_name_encrypted: string;
  service_name_iv: string;
  category: string;
  encrypted_data: string;
  data_iv: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  user_agent?: string;
  ip_address?: string;
  expires_at: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id: string;
  event_type: string;
  ip_address?: string;
  details?: string;
  created_at: string;
}

interface DBState {
  users: UserRecord[];
  vault_items: VaultItemRecord[];
  sessions: SessionRecord[];
  audit_logs: AuditLogRecord[];
}

export class DatabaseService {
  private driver: 'postgres' | 'sqlite';
  private pgPool: pg.Pool | null = null;
  private filePath: string = './data/securevault.json';
  private memoryState: DBState = {
    users: [],
    vault_items: [],
    sessions: [],
    audit_logs: [],
  };

  constructor() {
    this.driver = (process.env.DB_DRIVER === 'postgres') ? 'postgres' : 'sqlite';
  }

  public async init(): Promise<void> {
    if (this.driver === 'postgres') {
      try {
        this.pgPool = new pg.Pool({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: process.env.DB_NAME || 'securevault',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
        });
        // Test connection
        await this.pgPool.query('SELECT 1');
        // Execute migration
        const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
        if (fs.existsSync(migrationPath)) {
          const sql = fs.readFileSync(migrationPath, 'utf8');
          await this.pgPool.query(sql);
        }
        console.log('[Database] Connected to PostgreSQL successfully.');
        return;
      } catch (err) {
        console.warn('[Database] PostgreSQL connection failed. Falling back to local persistent store.', err);
        this.driver = 'sqlite';
      }
    }

    // Embedded Persistent Store (for standalone execution and offline demonstrations)
    const rawPath = process.env.DB_SQLITE_PATH || './data/securevault.json';
    this.filePath = path.resolve(process.cwd(), rawPath);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.memoryState = JSON.parse(raw);
      } catch {
        this.saveState();
      }
    } else {
      this.saveState();
    }
    console.log(`[Database] Initialized embedded secure store at ${this.filePath}`);
  }

  private saveState(): void {
    if (this.driver === 'sqlite') {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryState, null, 2), 'utf8');
    }
  }

  // --- Users ---
  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
      return res.rows[0] || null;
    }
    return this.memoryState.users.find(u => u.email.toLowerCase() === normalizedEmail) || null;
  }

  public async findUserById(id: string): Promise<UserRecord | null> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return this.memoryState.users.find(u => u.id === id) || null;
  }

  public async createUser(user: UserRecord): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO users (id, email, password_hash, auth_salt, vault_salt, recovery_encrypted_vault_key, recovery_key_iv, auto_lock_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [user.id, user.email, user.password_hash, user.auth_salt, user.vault_salt, user.recovery_encrypted_vault_key || null, user.recovery_key_iv || null, user.auto_lock_minutes, user.created_at, user.updated_at]
      );
      return;
    }
    this.memoryState.users.push(user);
    this.saveState();
  }

  public async updateUser(id: string, updates: Partial<UserRecord>): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      await this.pgPool.query(`UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
      return;
    }
    const idx = this.memoryState.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.memoryState.users[idx] = {
        ...this.memoryState.users[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveState();
    }
  }

  // --- Vault Items ---
  public async getVaultItemsByUserId(userId: string): Promise<VaultItemRecord[]> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM vault_items WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
      return res.rows;
    }
    return this.memoryState.vault_items
      .filter(item => item.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  public async findVaultItemById(id: string, userId: string): Promise<VaultItemRecord | null> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM vault_items WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.rows[0] || null;
    }
    return this.memoryState.vault_items.find(item => item.id === id && item.user_id === userId) || null;
  }

  public async createVaultItem(item: VaultItemRecord): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO vault_items (id, user_id, service_name_encrypted, service_name_iv, category, encrypted_data, data_iv, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [item.id, item.user_id, item.service_name_encrypted, item.service_name_iv, item.category, item.encrypted_data, item.data_iv, item.created_at, item.updated_at]
      );
      return;
    }
    this.memoryState.vault_items.push(item);
    this.saveState();
  }

  public async updateVaultItem(id: string, userId: string, updates: Partial<VaultItemRecord>): Promise<boolean> {
    if (this.driver === 'postgres' && this.pgPool) {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 3}`).join(', ');
      const res = await this.pgPool.query(
        `UPDATE vault_items SET ${setClause}, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
        [id, userId, ...values]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const idx = this.memoryState.vault_items.findIndex(i => i.id === id && i.user_id === userId);
    if (idx !== -1) {
      this.memoryState.vault_items[idx] = {
        ...this.memoryState.vault_items[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveState();
      return true;
    }
    return false;
  }

  public async deleteVaultItem(id: string, userId: string): Promise<boolean> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('DELETE FROM vault_items WHERE id = $1 AND user_id = $2', [id, userId]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = this.memoryState.vault_items.length;
    this.memoryState.vault_items = this.memoryState.vault_items.filter(i => !(i.id === id && i.user_id === userId));
    const deleted = this.memoryState.vault_items.length < initialLen;
    if (deleted) this.saveState();
    return deleted;
  }

  // --- Sessions ---
  public async createSession(session: SessionRecord): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO sessions (id, user_id, user_agent, ip_address, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [session.id, session.user_id, session.user_agent || null, session.ip_address || null, session.expires_at, session.created_at]
      );
      return;
    }
    // Clean old expired sessions
    const now = new Date().toISOString();
    this.memoryState.sessions = this.memoryState.sessions.filter(s => s.expires_at > now);
    this.memoryState.sessions.push(session);
    this.saveState();
  }

  public async findSessionById(id: string): Promise<SessionRecord | null> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()', [id]);
      return res.rows[0] || null;
    }
    const now = new Date().toISOString();
    return this.memoryState.sessions.find(s => s.id === id && s.expires_at > now) || null;
  }

  public async deleteSession(id: string): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query('DELETE FROM sessions WHERE id = $1', [id]);
      return;
    }
    this.memoryState.sessions = this.memoryState.sessions.filter(s => s.id !== id);
    this.saveState();
  }

  public async deleteSessionsByUserId(userId: string): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      return;
    }
    this.memoryState.sessions = this.memoryState.sessions.filter(s => s.user_id !== userId);
    this.saveState();
  }

  public async getSessionsByUserId(userId: string): Promise<SessionRecord[]> {
    const now = new Date().toISOString();
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId]
      );
      return res.rows;
    }
    return this.memoryState.sessions
      .filter(s => s.user_id === userId && s.expires_at > now)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async deleteOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query(
        'DELETE FROM sessions WHERE user_id = $1 AND id != $2',
        [userId, currentSessionId]
      );
      return res.rowCount ?? 0;
    }
    const initialCount = this.memoryState.sessions.length;
    this.memoryState.sessions = this.memoryState.sessions.filter(
      s => s.user_id !== userId || s.id === currentSessionId
    );
    const removed = initialCount - this.memoryState.sessions.length;
    if (removed > 0) this.saveState();
    return removed;
  }

  // --- Audit Logs ---
  public async logAuditEvent(log: AuditLogRecord): Promise<void> {
    if (this.driver === 'postgres' && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO audit_logs (id, user_id, event_type, ip_address, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [log.id, log.user_id, log.event_type, log.ip_address || null, log.details || null, log.created_at]
      );
      return;
    }
    this.memoryState.audit_logs.push(log);
    // Keep max 500 audit logs
    if (this.memoryState.audit_logs.length > 500) {
      this.memoryState.audit_logs = this.memoryState.audit_logs.slice(-500);
    }
    this.saveState();
  }

  public async getAuditLogsByUserId(userId: string, limit: number = 50): Promise<AuditLogRecord[]> {
    if (this.driver === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query(
        'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return res.rows;
    }
    return this.memoryState.audit_logs
      .filter(l => l.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }
}

export const db = new DatabaseService();
