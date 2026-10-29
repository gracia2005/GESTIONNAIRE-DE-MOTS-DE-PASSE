import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  KeyRound,
  Clock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  History,
  Download,
  Upload,
  Copy,
  Check,
  FileSpreadsheet,
  FileCode,
  Printer,
  Monitor,
  Smartphone,
  Laptop,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useVault } from '../context/VaultContext.js';
import { useToast } from '../components/Toast.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { apiRequest } from '../api/client.js';
import { AuditLogItem, VaultCategory, ActiveSession } from '../types/index.js';

export const SettingsPage: React.FC = () => {
  const { user, updateAutoLockMinutes, vaultKey, setVaultKeyDirectly, refreshUser, logout } = useAuth();
  const { items, reloadItems, addItem } = useVault();
  const { showToast } = useToast();

  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(user?.auto_lock_minutes || 15);
  const [isSavingAutoLock, setIsSavingAutoLock] = useState(false);

  // Change Master Password state
  const [currentMasterPassword, setCurrentMasterPassword] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [newlyCreatedRecoveryKey, setNewlyCreatedRecoveryKey] = useState<string | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);

  // Import / Export state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Active Sessions
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isRevokingOther, setIsRevokingOther] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setAutoLockMinutes(user.auto_lock_minutes);
    }
    loadAuditLogs();
    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const res = await apiRequest<{ sessions: ActiveSession[] }>('/user/sessions');
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (session: ActiveSession) => {
    try {
      setRevokingSessionId(session.id);
      const res = await apiRequest<{ is_current: boolean; message?: string }>(`/user/sessions/${session.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        if (res.is_current) {
          showToast('Votre session actuelle a été déconnectée.', 'info');
          await logout();
        } else {
          showToast('Appareil distant déconnecté avec succès.', 'success');
          await loadSessions();
          await loadAuditLogs();
        }
      } else {
        showToast(res.error || 'Erreur lors de la révocation.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la révocation.', 'error');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      setIsRevokingOther(true);
      const res = await apiRequest<{ revoked_count: number }>('/user/sessions/revoke-others', {
        method: 'POST',
      });
      if (res.success) {
        showToast(`${res.revoked_count} autre(s) appareil(s) déconnecté(s) avec succès.`, 'success');
        await loadSessions();
        await loadAuditLogs();
      } else {
        showToast(res.error || 'Erreur lors de la révocation.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur de déconnexion.', 'error');
    } finally {
      setIsRevokingOther(false);
    }
  };

  const parseUserAgent = (ua?: string) => {
    if (!ua) return { os: 'Système inconnu', browser: 'Client Web', isMobile: false };
    let os = 'Système inconnu';
    let browser = 'Navigateur Web';
    let isMobile = false;

    if (/iPhone/i.test(ua)) {
      os = 'iOS (iPhone)';
      isMobile = true;
    } else if (/iPad/i.test(ua)) {
      os = 'iPadOS';
      isMobile = true;
    } else if (/Android/i.test(ua)) {
      os = 'Android';
      isMobile = true;
    } else if (/Windows NT 10.0/i.test(ua)) {
      os = 'Windows 10/11';
    } else if (/Windows NT/i.test(ua)) {
      os = 'Windows';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      os = 'macOS';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    }

    if (/Edg\//i.test(ua)) {
      browser = 'Microsoft Edge';
    } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
      browser = 'Google Chrome';
    } else if (/Firefox\//i.test(ua)) {
      browser = 'Mozilla Firefox';
    } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
      browser = 'Apple Safari';
    }

    return { os, browser, isMobile };
  };

  const loadAuditLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const res = await apiRequest<{ logs: AuditLogItem[] }>('/audit/logs?limit=15');
      if (res.success && res.logs) {
        setAuditLogs(res.logs);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveAutoLock = async () => {
    try {
      setIsSavingAutoLock(true);
      const success = await updateAutoLockMinutes(autoLockMinutes);
      if (success) {
        showToast(`Délai d'inactivité configuré sur ${autoLockMinutes} minutes.`, 'success');
      } else {
        showToast('Erreur lors de la mise à jour du paramètre.', 'error');
      }
    } finally {
      setIsSavingAutoLock(false);
    }
  };

  const handleChangeMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vaultKey) {
      setPasswordChangeError('Le coffre-fort doit être déverrouillé.');
      return;
    }
    if (!currentMasterPassword) {
      setPasswordChangeError('Veuillez saisir le mot de passe maître actuel.');
      return;
    }
    if (newMasterPassword.length < 12) {
      setPasswordChangeError('Le nouveau mot de passe maître doit comporter au moins 12 caractères.');
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      setPasswordChangeError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setPasswordChangeError('');

      // Step 1: Derive current auth_hash to verify
      const currentAuthHash = await CryptoEngine.deriveAuthHash(currentMasterPassword, user.auth_salt);

      // Step 2: Generate brand new salts
      const newAuthSalt = CryptoEngine.generateSaltHex();
      const newVaultSalt = CryptoEngine.generateSaltHex();

      // Step 3: Derive new auth_hash and new vault key
      const newAuthHash = await CryptoEngine.deriveAuthHash(newMasterPassword, newAuthSalt);
      const newDerivedVaultKey = await CryptoEngine.deriveVaultKey(newMasterPassword, newVaultSalt);

      // Step 4: Re-encrypt all existing items in RAM with the new vault key
      const reEncryptedItems = [];
      for (const item of items) {
        const encService = await CryptoEngine.encryptString(item.service_name, newDerivedVaultKey);
        const encData = await CryptoEngine.encryptVaultData(
          {
            username: item.username,
            password: item.password,
            url: item.url,
            notes: item.notes,
          },
          newDerivedVaultKey
        );

        reEncryptedItems.push({
          id: item.id,
          service_name_encrypted: encService.ciphertext,
          service_name_iv: encService.iv,
          category: item.category,
          encrypted_data: encData.ciphertext,
          data_iv: encData.iv,
        });
      }

      // Step 5: Generate a new Recovery Key and encrypt new vault key with it
      const newRecoveryKey = CryptoEngine.generateRecoveryKey();
      const newEncryptedRecovery = await CryptoEngine.encryptVaultKeyWithRecovery(newDerivedVaultKey, newRecoveryKey);

      // Step 6: Atomic update on server
      const res = await apiRequest('/user/change-master-key', {
        method: 'POST',
        body: JSON.stringify({
          current_auth_hash: currentAuthHash,
          new_auth_hash: newAuthHash,
          new_auth_salt: newAuthSalt,
          new_vault_salt: newVaultSalt,
          new_recovery_encrypted_vault_key: newEncryptedRecovery.ciphertext,
          new_recovery_key_iv: newEncryptedRecovery.iv,
          re_encrypted_items: reEncryptedItems,
        }),
      });

      if (!res.success) {
        throw new Error(res.error || 'Erreur lors du changement de mot de passe maître.');
      }

      setVaultKeyDirectly(newDerivedVaultKey);
      await refreshUser();
      setNewlyCreatedRecoveryKey(newRecoveryKey);
      showToast('Mot de passe maître modifié et coffre intégralement re-chiffré !', 'success');
      setCurrentMasterPassword('');
      setNewMasterPassword('');
      setConfirmMasterPassword('');
      await reloadItems();
      await loadAuditLogs();
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Erreur lors du processus de re-chiffrement.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyNewRecoveryKey = () => {
    if (!newlyCreatedRecoveryKey) return;
    navigator.clipboard.writeText(newlyCreatedRecoveryKey);
    setCopiedRecoveryKey(true);
    showToast('Clé de secours copiée dans le presse-papiers !', 'success');
    setTimeout(() => setCopiedRecoveryKey(false), 2000);
  };

  const handleDownloadNewRecoveryKey = () => {
    if (!newlyCreatedRecoveryKey) return;
    const content = `=====================================================
SECUREVAULT — NOUVELLE CLÉ DE SECOURS D'URGENCE (RECOVERY KEY)
=====================================================
Compte : ${user?.email || 'compte'}
Date : ${new Date().toISOString()}

VOTRE NOUVELLE CLÉ DE SECOURS :
${newlyCreatedRecoveryKey}

IMPORTANT :
- Suite au changement de votre mot de passe maître, cette clé remplace la précédente.
- Conservez ce fichier dans un endroit sûr hors ligne.
=====================================================`;
    downloadFile(content, `SecureVault-New-Recovery-Key-${user?.email || 'vault'}.txt`, 'text/plain');
    showToast('Fichier de nouvelle clé de secours téléchargé.', 'success');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('Votre coffre est vide, rien à exporter.', 'info');
      return;
    }
    const headers = ['service_name', 'category', 'username', 'password', 'url', 'notes'];
    const rows = items.map(item => [
      `"${(item.service_name || '').replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      `"${(item.username || '').replace(/"/g, '""')}"`,
      `"${(item.password || '').replace(/"/g, '""')}"`,
      `"${(item.url || '').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csvContent, `securevault-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showToast('Coffre-fort exporté au format CSV !', 'success');
  };

  // Export JSON
  const handleExportJSON = () => {
    if (items.length === 0) {
      showToast('Votre coffre est vide, rien à exporter.', 'info');
      return;
    }
    const safeData = items.map(item => ({
      service_name: item.service_name,
      category: item.category,
      username: item.username,
      password: item.password,
      url: item.url,
      notes: item.notes,
    }));
    const jsonContent = JSON.stringify(safeData, null, 2);
    downloadFile(jsonContent, `securevault-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    showToast('Coffre-fort exporté au format JSON !', 'success');
  };

  // Import JSON / CSV
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      let importedCount = 0;

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error('Le fichier JSON doit contenir une liste d’identifiants.');
        }

        for (const entry of parsed) {
          if (!entry.service_name || !entry.password) continue;
          await addItem({
            service_name: String(entry.service_name).trim(),
            category: (['social', 'emails', 'banks', 'work', 'studies', 'other'].includes(entry.category)
              ? entry.category
              : 'other') as VaultCategory,
            username: String(entry.username || '').trim(),
            password: String(entry.password),
            url: entry.url ? String(entry.url).trim() : undefined,
            notes: entry.notes ? String(entry.notes).trim() : undefined,
          });
          importedCount++;
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          throw new Error('Le fichier CSV est vide ou ne contient que les en-têtes.');
        }

        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map(h => h.replace(/["\s]/g, ''));

        const sIdx = headers.indexOf('service_name') !== -1 ? headers.indexOf('service_name') : headers.indexOf('name') !== -1 ? headers.indexOf('name') : 0;
        const uIdx = headers.indexOf('username') !== -1 ? headers.indexOf('username') : headers.indexOf('login') !== -1 ? headers.indexOf('login') : 2;
        const pIdx = headers.indexOf('password') !== -1 ? headers.indexOf('password') : 3;
        const cIdx = headers.indexOf('category');
        const urlIdx = headers.indexOf('url') !== -1 ? headers.indexOf('url') : headers.indexOf('uri');
        const nIdx = headers.indexOf('notes');

        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let char of lines[i]) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const sName = (values[sIdx] || '').replace(/^"|"$/g, '');
          const pwd = (values[pIdx] || '').replace(/^"|"$/g, '');
          if (!sName || !pwd) continue;

          const catRaw = cIdx !== -1 ? (values[cIdx] || '').replace(/^"|"$/g, '') : 'other';
          const cat = ['social', 'emails', 'banks', 'work', 'studies', 'other'].includes(catRaw) ? (catRaw as VaultCategory) : 'other';

          await addItem({
            service_name: sName,
            category: cat,
            username: (values[uIdx] || '').replace(/^"|"$/g, ''),
            password: pwd,
            url: urlIdx !== -1 ? (values[urlIdx] || '').replace(/^"|"$/g, '') : undefined,
            notes: nIdx !== -1 ? (values[nIdx] || '').replace(/^"|"$/g, '') : undefined,
          });
          importedCount++;
        }
      } else {
        throw new Error('Format de fichier non supporté. Veuillez choisir un fichier .json ou .csv.');
      }

      await reloadItems();
      showToast(`${importedCount} identifiant(s) importé(s) et chiffré(s) avec succès !`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de l’importation.', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePrintEmergencyKit = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Impossible d’ouvrir la fenêtre d’impression. Vérifiez vos bloqueurs de pop-ups.', 'error');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Kit d'Urgence Cryptographique — SecureVault</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
    .header { border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 18px; background: #f8fafc; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-bottom: 6px; }
    .value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #0f172a; word-break: break-all; }
    .warning { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #92400e; margin-bottom: 20px; }
    .write-slot { border: 2px dashed #94a3b8; border-radius: 8px; padding: 16px; min-height: 30px; background: #ffffff; }
    .instructions { font-size: 12px; color: #475569; }
    .instructions ol { padding-left: 20px; margin: 8px 0; }
    @media print { body { margin: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">🛡️ SecureVault — Kit d'Urgence Cryptographique</h1>
      <div class="subtitle">Document de secours confidentiel pour la récupération de compte (Zero-Knowledge)</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      Date : ${new Date().toLocaleDateString('fr-FR')}<br>
      Classification : Confidentiel
    </div>
  </div>

  <div class="warning">
    <strong>⚠️ CONFIDENTIEL — CONSERVATION HORS-LIGNE STRICTE :</strong><br>
    Ce document contient les informations critiques requises pour restaurer vos identifiants chiffrés. Conservez cette feuille dans un endroit sécurisé (coffre-fort physique ou lieu inaccessible aux tiers).
  </div>

  <div class="box">
    <div class="label">Identifiant du Compte (E-mail)</div>
    <div class="value">${user?.email || 'compte@exemple.com'}</div>
  </div>

  <div class="box">
    <div class="label">Emplacement réservé à votre mot de passe maître (manuscrit)</div>
    <div class="write-slot">
      <span style="color: #94a3b8; font-size: 11px; font-style: italic;">
        Inscrivez votre mot de passe maître ici à la main si souhaité :
      </span>
    </div>
  </div>

  <div class="box">
    <div class="label">Procédure de Restauration d'Urgence</div>
    <div class="instructions">
      <ol>
        <li>Accédez à l'application SecureVault et cliquez sur <strong>"Mot de passe oublié ?"</strong>.</li>
        <li>Renseignez votre adresse e-mail ainsi que votre <strong>Clé de Secours d'Urgence</strong>.</li>
        <li>Définissez un nouveau mot de passe maître. L'ensemble de votre coffre sera déchiffré puis ré-encodé instantanément.</li>
      </ol>
    </div>
  </div>

  <div style="margin-top: 30px; text-align: center;" class="no-print">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; font-weight: bold; background: #059669; color: white; border: none; border-radius: 8px; cursor: pointer;">
      🖨️ Imprimer ce document
    </button>
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-500" />
          <span>Paramètres de sécurité & Confidentialité</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gérez le comportement du coffre, vos délais d'inactivité et vos clés de sécurité.
        </p>
      </div>

      {/* Auto-Lock Inactivity Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Verrouillage automatique par inactivité
            </h3>
            <p className="text-xs text-slate-400">
              Purge instantanément la clé maîtresse de la mémoire RAM après une durée sans interaction.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {[1, 5, 15, 30, 60].map(mins => (
            <button
              key={mins}
              onClick={() => setAutoLockMinutes(mins)}
              className={`p-3 rounded-xl border text-center transition-all ${
                autoLockMinutes === mins
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <span className="block text-base font-mono">{mins} min</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {mins === 1 ? 'Ultra-sécurisé' : mins === 15 ? 'Standard' : 'Confort'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveAutoLock}
            disabled={isSavingAutoLock || autoLockMinutes === user?.auto_lock_minutes}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingAutoLock ? 'Enregistrement...' : 'Enregistrer le délai'}</span>
          </button>
        </div>
      </div>

      {/* Change Master Password Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Modifier le mot de passe maître
            </h3>
            <p className="text-xs text-slate-400">
              Déclenche le re-chiffrement complet et atomique de toutes les entrées de votre coffre.
            </p>
          </div>
        </div>

        {passwordChangeError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
            {passwordChangeError}
          </div>
        )}

        <form onSubmit={handleChangeMasterPassword} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Mot de passe maître actuel
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentMasterPassword}
                onChange={e => setCurrentMasterPassword(e.target.value)}
                required
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 pr-10 text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nouveau mot de passe maître (min. 12 car.)
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newMasterPassword}
                  onChange={e => setNewMasterPassword(e.target.value)}
                  required
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 pr-10 text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmMasterPassword}
                onChange={e => setConfirmMasterPassword(e.target.value)}
                required
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isChangingPassword ? 'Re-chiffrement du coffre...' : 'Re-chiffrer et mettre à jour'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Sessions & Connected Devices */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Sessions Actives & Appareils Connectés</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {sessions.length} {sessions.length > 1 ? 'appareils' : 'appareil'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gérez les appareils connectés à votre compte et déconnectez les sessions distantes suspectes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadSessions}
              disabled={isLoadingSessions}
              title="Actualiser la liste des sessions"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSessions ? 'animate-spin' : ''}`} />
            </button>
            {sessions.filter(s => !s.is_current).length > 0 && (
              <button
                onClick={handleRevokeOtherSessions}
                disabled={isRevokingOther}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isRevokingOther ? 'Déconnexion...' : 'Déconnecter les autres appareils'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pt-1">
          {isLoadingSessions && sessions.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Chargement des sessions actives...</p>
          ) : sessions.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Aucune session active détectée.</p>
          ) : (
            sessions.map(session => {
              const { os, browser, isMobile } = parseUserAgent(session.user_agent);
              return (
                <div key={session.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                      {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {browser} · {os}
                        </span>
                        {session.is_current && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Cette session (Actuelle)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>IP : {session.ip_address || '127.0.0.1'}</span>
                        <span>•</span>
                        <span>Connexion : {new Date(session.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    {session.is_current ? (
                      <span className="text-[11px] font-medium text-slate-400 italic">Appareil utilisé</span>
                    ) : (
                      <button
                        onClick={() => handleRevokeSession(session)}
                        disabled={revokingSessionId === session.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200/60 dark:border-red-900/60 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{revokingSessionId === session.id ? 'Déconnexion...' : 'Déconnecter'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Security Audit Log View (Transparency) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Journal des événements de sécurité
              </h3>
              <p className="text-xs text-slate-400">
                Traçabilité des connexions et opérations. Strictement aucun secret ni mot de passe enregistré.
              </p>
            </div>
          </div>
          <button
            onClick={loadAuditLogs}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Rafraîchir
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
          {isLoadingLogs ? (
            <p className="py-4 text-center text-xs text-slate-400">Chargement des journaux...</p>
          ) : auditLogs.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Aucun journal disponible.</p>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                    [{log.event_type}]
                  </span>
                  <p className="text-slate-400 text-[11px] mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-[10px] text-slate-400 shrink-0 font-mono">
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                  {log.ip_address && <span className="block text-slate-500">IP: {log.ip_address}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Export & Import Data Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Sauvegarde, Exportation & Importation
            </h3>
            <p className="text-xs text-slate-400">
              Exportez ou restaurez vos identifiants au format JSON ou CSV compatible Bitwarden / Chrome.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Exporter en CSV</span>
              <span className="text-[10px] text-slate-400">Tableau Excel / CSV</span>
            </div>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJSON}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Exporter en JSON</span>
              <span className="text-[10px] text-slate-400">Format d'échange</span>
            </div>
          </button>

          {/* Import JSON / CSV */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full h-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center text-center gap-2 disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {isImporting ? 'Importation...' : 'Importer (.csv, .json)'}
                </span>
                <span className="text-[10px] text-slate-400">Chiffrement client</span>
              </div>
            </button>
          </div>

          {/* Printable Emergency Kit */}
          <button
            onClick={handlePrintEmergencyKit}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Kit d'Urgence PDF</span>
              <span className="text-[10px] text-slate-400">Fiche de secours imprimable</span>
            </div>
          </button>
        </div>
      </div>

      {/* Account Recovery Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold mb-1">Avis de Non-Responsabilité Cryptographique (Zero-Knowledge)</h4>
          <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
            En raison de la conception cryptographique étanche de SecureVault, si vous oubliez votre mot de passe maître ET que vous ne possédez pas votre Clé de Secours d'Urgence, vos données chiffrées sont <strong>définitivement irrécupérables</strong>. Ni notre équipe, ni l'administrateur du serveur ne disposent d'une porte dérobée.
          </p>
        </div>
      </div>

      {/* New Recovery Key Modal (After Master Password Change) */}
      {newlyCreatedRecoveryKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-1">
                <KeyRound className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Nouvelle Clé de Secours d'Urgence
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Votre mot de passe maître a été changé et tout votre coffre a été re-chiffré. Cette nouvelle clé remplace définitivement l'ancienne.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl font-mono text-center text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 tracking-wider select-all border border-slate-200 dark:border-slate-800 break-all">
                {newlyCreatedRecoveryKey}
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyNewRecoveryKey}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  {copiedRecoveryKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRecoveryKey ? 'Copié !' : 'Copier la clé'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadNewRecoveryKey}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger (.txt)</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <p>
                Conservez cette clé hors ligne. L'ancienne clé est maintenant révoquée et ne pourra plus déverrouiller votre coffre.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNewlyCreatedRecoveryKey(null)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
            >
              <span>J'ai sauvegardé ma nouvelle clé</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
