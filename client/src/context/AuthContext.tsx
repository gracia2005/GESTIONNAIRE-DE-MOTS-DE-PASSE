import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile } from '../types/index.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { apiRequest } from '../api/client.js';

interface AuthContextType {
  user: UserProfile | null;
  vaultKey: CryptoKey | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  login: (email: string, masterPassword: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, masterPassword: string) => Promise<{ success: boolean; recoveryKey?: string; user?: UserProfile; vaultKey?: CryptoKey; error?: string }>;
  completeRegistration: (user: UserProfile, key: CryptoKey) => void;
  unlock: (masterPassword: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
  logout: () => Promise<void>;
  updateAutoLockMinutes: (minutes: number) => Promise<boolean>;
  setVaultKeyDirectly: (key: CryptoKey | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    // Zero-Knowledge Security: Wipe the cryptographic key from volatile memory
    setVaultKey(null);
    setIsLocked(true);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (!user || isLocked || !vaultKey) return;

    const timeoutMs = (user.auto_lock_minutes || 15) * 60 * 1000;
    inactivityTimerRef.current = setTimeout(() => {
      console.warn('[Auto-Lock] Inactivité détectée. Verrouillage sécurisé du coffre-fort.');
      lock();
    }, timeoutMs);
  }, [user, isLocked, vaultKey, lock]);

  // Setup user activity listeners for auto-lock
  useEffect(() => {
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach(evt => window.addEventListener(evt, handleActivity));
    resetInactivityTimer();

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  // Initial session restoration
  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: UserProfile }>('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
        // Session exists, but master key is not in memory -> start locked
        if (!vaultKey) {
          setIsLocked(true);
        }
      } else {
        setUser(null);
        setVaultKey(null);
        setIsLocked(false);
      }
    } catch {
      setUser(null);
      setVaultKey(null);
      setIsLocked(false);
    } finally {
      setIsLoading(false);
    }
  }, [vaultKey]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, masterPassword: string) => {
    try {
      setIsLoading(true);
      // Step 1: Request salts from server
      const saltsRes = await apiRequest<{
        auth_salt: string;
        vault_salt: string;
        exists: boolean;
      }>('/auth/salts', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!saltsRes.success) {
        return { success: false, error: saltsRes.error || 'Erreur lors de la récupération des paramètres de sécurité.' };
      }

      // Step 2: Derive auth hash and vault encryption key
      const authHash = await CryptoEngine.deriveAuthHash(masterPassword, saltsRes.auth_salt);
      const derivedVaultKey = await CryptoEngine.deriveVaultKey(masterPassword, saltsRes.vault_salt);

      // Step 3: Authenticate with server
      const loginRes = await apiRequest<{ user: UserProfile }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, auth_hash: authHash }),
      });

      if (!loginRes.success || !loginRes.user) {
        return { success: false, error: loginRes.error || 'Identifiants invalides.' };
      }

      setUser(loginRes.user);
      setVaultKey(derivedVaultKey);
      setIsLocked(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur de connexion.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, masterPassword: string) => {
    try {
      setIsLoading(true);
      // Generate unique random salts
      const authSalt = CryptoEngine.generateSaltHex();
      const vaultSalt = CryptoEngine.generateSaltHex();

      // Derive authentication hash and vault master key
      const authHash = await CryptoEngine.deriveAuthHash(masterPassword, authSalt);
      const derivedVaultKey = await CryptoEngine.deriveVaultKey(masterPassword, vaultSalt);

      // Generate Emergency Recovery Key and encrypt vault key with it
      const recoveryKey = CryptoEngine.generateRecoveryKey();
      const encryptedRecovery = await CryptoEngine.encryptVaultKeyWithRecovery(derivedVaultKey, recoveryKey);

      const res = await apiRequest<{ user: UserProfile }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          auth_hash: authHash,
          auth_salt: authSalt,
          vault_salt: vaultSalt,
          recovery_encrypted_vault_key: encryptedRecovery.ciphertext,
          recovery_key_iv: encryptedRecovery.iv,
        }),
      });

      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Erreur lors de l’inscription.' };
      }

      return {
        success: true,
        recoveryKey,
        user: res.user,
        vaultKey: derivedVaultKey,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur d’enregistrement.' };
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = useCallback((registeredUser: UserProfile, key: CryptoKey) => {
    setUser(registeredUser);
    setVaultKey(key);
    setIsLocked(false);
  }, []);

  const unlock = async (masterPassword: string) => {
    if (!user) return { success: false, error: 'Aucun utilisateur actif.' };

    try {
      // Verify master password by deriving auth_hash and comparing via quick auth check
      const authHash = await CryptoEngine.deriveAuthHash(masterPassword, user.auth_salt);
      const loginCheck = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, auth_hash: authHash }),
      });

      if (!loginCheck.success) {
        return { success: false, error: 'Mot de passe maître erroné.' };
      }

      // Re-derive vault key into RAM
      const key = await CryptoEngine.deriveVaultKey(masterPassword, user.vault_salt);
      setVaultKey(key);
      setIsLocked(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors du déverrouillage.' };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setVaultKey(null);
      setIsLocked(false);
    }
  };

  const updateAutoLockMinutes = async (minutes: number) => {
    const res = await apiRequest('/user/settings', {
      method: 'PUT',
      body: JSON.stringify({ auto_lock_minutes: minutes }),
    });

    if (res.success) {
      setUser(prev => (prev ? { ...prev, auto_lock_minutes: minutes } : null));
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        vaultKey,
        isAuthenticated: !!user,
        isLocked,
        isLoading,
        login,
        register,
        completeRegistration,
        unlock,
        lock,
        logout,
        updateAutoLockMinutes,
        setVaultKeyDirectly: setVaultKey,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
