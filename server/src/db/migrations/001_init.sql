-- SecureVault Database Schema (PostgreSQL)
-- Zero-Knowledge architecture: Server NEVER stores plaintext passwords, plaintext vault data, or master keys.

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,            -- bcrypt hash of client-derived auth_hash
    auth_salt VARCHAR(64) NOT NULL,                 -- Public salt for authentication PBKDF2
    vault_salt VARCHAR(64) NOT NULL,                -- Public salt for vault encryption PBKDF2
    recovery_encrypted_vault_key TEXT,              -- Vault key encrypted with emergency recovery key
    recovery_key_iv VARCHAR(64),                    -- IV for recovery key encryption
    auto_lock_minutes INTEGER DEFAULT 15,           -- Auto-lock inactivity timeout (minutes)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_items (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_name_encrypted TEXT NOT NULL,           -- Encrypted service name (AES-256-GCM)
    service_name_iv VARCHAR(64) NOT NULL,           -- Unique IV for service name
    category VARCHAR(50) NOT NULL DEFAULT 'other',  -- social, emails, banks, work, studies, other
    encrypted_data TEXT NOT NULL,                   -- Encrypted JSON: { username, password, url, notes }
    data_iv VARCHAR(64) NOT NULL,                   -- Unique IV for data payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_category ON vault_items(category);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,                    -- Cryptographically random session token
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    details TEXT,                                   -- Safe metadata only; strictly NO secrets or passwords
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
