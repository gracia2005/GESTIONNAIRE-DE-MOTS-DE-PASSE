export type VaultCategory = 'social' | 'emails' | 'banks' | 'work' | 'studies' | 'other';

export interface DecryptedVaultItem {
  id: string;
  service_name: string;
  category: VaultCategory;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  totp_secret?: string;
  favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EncryptedVaultItemRecord {
  id: string;
  service_name_encrypted: string;
  service_name_iv: string;
  category: VaultCategory;
  encrypted_data: string;
  data_iv: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  auto_lock_minutes: number;
  auth_salt: string;
  vault_salt: string;
  recovery_encrypted_vault_key?: string;
  recovery_key_iv?: string;
}

export interface SecurityAuditResult {
  overallScore: number;
  totalItems: number;
  weakCount: number;
  reusedCount: number;
  missingDataCount: number;
  staleCount: number;
  weakItems: { item: DecryptedVaultItem; reason: string }[];
  reusedGroups: { password: string; items: DecryptedVaultItem[] }[];
  missingDataItems: { item: DecryptedVaultItem; issues: string[] }[];
}

export interface AuditLogItem {
  id: string;
  event_type: string;
  ip_address?: string;
  details?: string;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}
