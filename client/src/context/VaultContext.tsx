import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DecryptedVaultItem, EncryptedVaultItemRecord, VaultCategory, SecurityAuditResult } from '../types/index.js';
import { useAuth } from './AuthContext.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { apiRequest } from '../api/client.js';

interface VaultContextType {
  items: DecryptedVaultItem[];
  filteredItems: DecryptedVaultItem[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  addItem: (data: {
    service_name: string;
    category: VaultCategory;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    totp_secret?: string;
    favorite?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  updateItem: (
    id: string,
    data: {
      service_name: string;
      category: VaultCategory;
      username: string;
      password: string;
      url?: string;
      notes?: string;
      totp_secret?: string;
      favorite?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  toggleFavorite: (id: string) => Promise<boolean>;
  deleteItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  reloadItems: () => Promise<void>;
  auditResult: SecurityAuditResult;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vaultKey, isLocked, isAuthenticated } = useAuth();
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const reloadItems = useCallback(async () => {
    if (!isAuthenticated || isLocked || !vaultKey) {
      setItems([]);
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiRequest<{ items: EncryptedVaultItemRecord[] }>('/vault');
      if (!res.success || !res.items) {
        setItems([]);
        return;
      }

      // Decrypt each item locally in browser memory
      const decryptedList: DecryptedVaultItem[] = [];
      for (const encItem of res.items) {
        try {
          const service_name = await CryptoEngine.decryptString(
            {
              ciphertext: encItem.service_name_encrypted,
              iv: encItem.service_name_iv,
            },
            vaultKey
          );

          const secretData = await CryptoEngine.decryptVaultData(
            {
              ciphertext: encItem.encrypted_data,
              iv: encItem.data_iv,
            },
            vaultKey
          );

          decryptedList.push({
            id: encItem.id,
            service_name,
            category: encItem.category,
            username: secretData.username,
            password: secretData.password,
            url: secretData.url,
            notes: secretData.notes,
            totp_secret: secretData.totp_secret,
            favorite: secretData.favorite,
            created_at: encItem.created_at,
            updated_at: encItem.updated_at,
          });
        } catch (decryptErr) {
          console.error(`Impossible de déchiffrer l'entrée ${encItem.id}:`, decryptErr);
        }
      }

      setItems(decryptedList);
    } catch (err) {
      console.error('Erreur lors du chargement du coffre:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isLocked, vaultKey]);

  useEffect(() => {
    reloadItems();
  }, [reloadItems]);

  const addItem = async (data: {
    service_name: string;
    category: VaultCategory;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    totp_secret?: string;
    favorite?: boolean;
  }) => {
    if (!vaultKey) return { success: false, error: 'Coffre-fort verrouillé.' };

    try {
      // Encrypt service name
      const encService = await CryptoEngine.encryptString(data.service_name, vaultKey);

      // Encrypt sensitive secrets
      const encData = await CryptoEngine.encryptVaultData(
        {
          username: data.username,
          password: data.password,
          url: data.url,
          notes: data.notes,
          totp_secret: data.totp_secret,
          favorite: data.favorite,
        },
        vaultKey
      );

      const res = await apiRequest('/vault', {
        method: 'POST',
        body: JSON.stringify({
          service_name_encrypted: encService.ciphertext,
          service_name_iv: encService.iv,
          category: data.category,
          encrypted_data: encData.ciphertext,
          data_iv: encData.iv,
        }),
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Erreur lors de la création.' };
      }

      await reloadItems();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur de chiffrement.' };
    }
  };

  const updateItem = async (
    id: string,
    data: {
      service_name: string;
      category: VaultCategory;
      username: string;
      password: string;
      url?: string;
      notes?: string;
      totp_secret?: string;
      favorite?: boolean;
    }
  ) => {
    if (!vaultKey) return { success: false, error: 'Coffre-fort verrouillé.' };

    try {
      const encService = await CryptoEngine.encryptString(data.service_name, vaultKey);
      const encData = await CryptoEngine.encryptVaultData(
        {
          username: data.username,
          password: data.password,
          url: data.url,
          notes: data.notes,
          totp_secret: data.totp_secret,
          favorite: data.favorite,
        },
        vaultKey
      );

      const res = await apiRequest(`/vault/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          service_name_encrypted: encService.ciphertext,
          service_name_iv: encService.iv,
          category: data.category,
          encrypted_data: encData.ciphertext,
          data_iv: encData.iv,
        }),
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Erreur lors de la modification.' };
      }

      await reloadItems();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la mise à jour.' };
    }
  };

  const toggleFavorite = async (id: string): Promise<boolean> => {
    const item = items.find(i => i.id === id);
    if (!item) return false;
    const res = await updateItem(id, {
      service_name: item.service_name,
      category: item.category,
      username: item.username,
      password: item.password,
      url: item.url,
      notes: item.notes,
      totp_secret: item.totp_secret,
      favorite: !item.favorite,
    });
    return res.success;
  };

  const deleteItem = async (id: string) => {
    try {
      const res = await apiRequest(`/vault/${id}`, {
        method: 'DELETE',
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Erreur lors de la suppression.' };
      }

      setItems(prev => prev.filter(i => i.id !== id));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur de suppression.' };
    }
  };

  // Filtered Items (Client-side memory search)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      let matchesCategory = true;
      if (selectedCategory === 'favorites') {
        matchesCategory = !!item.favorite;
      } else if (selectedCategory !== 'all') {
        matchesCategory = item.category === selectedCategory;
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesSearch =
        item.service_name.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.url && item.url.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Local Security Audit Evaluation (100% in RAM)
  const auditResult = useMemo<SecurityAuditResult>(() => {
    if (items.length === 0) {
      return {
        overallScore: 100,
        totalItems: 0,
        weakCount: 0,
        reusedCount: 0,
        missingDataCount: 0,
        staleCount: 0,
        weakItems: [],
        reusedGroups: [],
        missingDataItems: [],
      };
    }

    const weakItems: { item: DecryptedVaultItem; reason: string }[] = [];
    const passwordMap: Map<string, DecryptedVaultItem[]> = new Map();
    const missingDataItems: { item: DecryptedVaultItem; issues: string[] }[] = [];
    let staleCount = 0;
    const now = Date.now();

    items.forEach(item => {
      // Weakness evaluation
      const strength = CryptoEngine.evaluatePasswordStrength(item.password);
      if (strength.score < 60) {
        weakItems.push({
          item,
          reason: strength.feedback.length > 0 ? strength.feedback[0] : 'Entropie trop faible.',
        });
      }

      // Reused password check
      const list = passwordMap.get(item.password) || [];
      list.push(item);
      passwordMap.set(item.password, list);

      // Missing metadata check
      const issues: string[] = [];
      if (!item.username.trim()) issues.push('Nom d’utilisateur manquant');
      if (!item.url?.trim()) issues.push('URL du service manquante');
      if (issues.length > 0) {
        missingDataItems.push({ item, issues });
      }

      // Stale entry check (> 90 days)
      const ageDays = (now - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 90) {
        staleCount++;
      }
    });

    const reusedGroups = Array.from(passwordMap.entries())
      .filter(([_, list]) => list.length > 1)
      .map(([password, list]) => ({ password, items: list }));

    const reusedCount = reusedGroups.reduce((acc, g) => acc + g.items.length, 0);

    // Documented Overall Vault Health Score Calculation:
    // Base 100 points
    // -12 pts per weak password
    // -10 pts per reused password
    // -4 pts per missing URL/username
    // Clamped between 0 and 100
    let penalty = weakItems.length * 12 + reusedCount * 10 + missingDataItems.length * 4;
    const overallScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / items.length) * 20)));

    return {
      overallScore,
      totalItems: items.length,
      weakCount: weakItems.length,
      reusedCount,
      missingDataCount: missingDataItems.length,
      staleCount,
      weakItems,
      reusedGroups,
      missingDataItems,
    };
  }, [items]);

  return (
    <VaultContext.Provider
      value={{
        items,
        filteredItems,
        isLoading,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        addItem,
        updateItem,
        toggleFavorite,
        deleteItem,
        reloadItems,
        auditResult,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
};
