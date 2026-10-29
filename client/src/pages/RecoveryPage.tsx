import React, { useState } from 'react';
import {
  KeyRound,
  ShieldAlert,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  Copy,
  Download,
  Check,
} from 'lucide-react';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../components/Toast.js';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter.js';

interface RecoveryPageProps {
  onGoToLogin: () => void;
}

export const RecoveryPage: React.FC<RecoveryPageProps> = ({ onGoToLogin }) => {
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [newlyGeneratedRecoveryKey, setNewlyGeneratedRecoveryKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyRecoveryKey = () => {
    if (!newlyGeneratedRecoveryKey) return;
    navigator.clipboard.writeText(newlyGeneratedRecoveryKey);
    setCopiedKey(true);
    showToast('Nouvelle clé de secours copiée dans le presse-papiers !', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadRecoveryKey = () => {
    if (!newlyGeneratedRecoveryKey) return;
    const content = `=====================================================
SECUREVAULT — NOUVELLE CLÉ DE SECOURS D'URGENCE (RECOVERY KEY)
=====================================================
Compte : ${email}
Date de renouvellement : ${new Date().toISOString()}

VOTRE NOUVELLE CLÉ DE SECOURS :
${newlyGeneratedRecoveryKey}

IMPORTANT :
- Conservez ce fichier dans un endroit sûr hors ligne (ex: clé USB chiffrée, coffre-fort physique).
- L'ancienne clé de secours est désormais invalidée.
- En cas d'oubli de votre mot de passe maître, cette clé est le SEUL moyen de déchiffrer votre coffre.
- Si vous perdez votre mot de passe maître ET cette clé, vos données sont DÉFINITIVEMENT IRRÉCUPÉRABLES.
=====================================================`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureVault-New-Recovery-Key-${email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Nouveau fichier de secours téléchargé.', 'success');
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !recoveryKey || !newMasterPassword) {
      setError('Veuillez renseigner tous les champs obligatoires.');
      return;
    }
    if (newMasterPassword.length < 12) {
      setError('Le nouveau mot de passe maître doit comporter au moins 12 caractères.');
      return;
    }
    if (newMasterPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Step 1: Fetch user recovery blob and encrypted items from server
      const saltsRes = await apiRequest<{
        auth_salt: string;
        vault_salt: string;
        recovery_encrypted_vault_key?: string;
        recovery_key_iv?: string;
        encrypted_items?: Array<{
          id: string;
          service_name_encrypted: string;
          service_name_iv: string;
          category: string;
          encrypted_data: string;
          data_iv: string;
        }>;
        exists: boolean;
      }>('/auth/salts', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!saltsRes.success || !saltsRes.exists || !saltsRes.recovery_encrypted_vault_key || !saltsRes.recovery_key_iv) {
        throw new Error('Aucun compte ou sauvegarde de récupération trouvé pour cet e-mail.');
      }

      // Step 2: Decrypt the master vault key using the recovery key in client RAM
      let recoveredVaultKey: CryptoKey;
      try {
        recoveredVaultKey = await CryptoEngine.decryptVaultKeyWithRecovery(
          {
            ciphertext: saltsRes.recovery_encrypted_vault_key,
            iv: saltsRes.recovery_key_iv,
          },
          recoveryKey.trim()
        );
      } catch (decryptErr) {
        throw new Error('La clé de secours fournie est incorrecte ou invalide pour ce compte.');
      }

      // Step 3: Derive new authentication and vault parameters for the new master password
      const newAuthSalt = CryptoEngine.generateSaltHex();
      const newVaultSalt = CryptoEngine.generateSaltHex();

      const newAuthHash = await CryptoEngine.deriveAuthHash(newMasterPassword, newAuthSalt);
      const newVaultKey = await CryptoEngine.deriveVaultKey(newMasterPassword, newVaultSalt);

      // Re-encrypt all existing items with the newly derived vault key
      const reEncryptedItems = [];
      if (saltsRes.encrypted_items && saltsRes.encrypted_items.length > 0) {
        for (const item of saltsRes.encrypted_items) {
          const serviceName = await CryptoEngine.decryptString(
            { ciphertext: item.service_name_encrypted, iv: item.service_name_iv },
            recoveredVaultKey
          );
          const rawData = await CryptoEngine.decryptString(
            { ciphertext: item.encrypted_data, iv: item.data_iv },
            recoveredVaultKey
          );

          const reEncService = await CryptoEngine.encryptString(serviceName, newVaultKey);
          const reEncData = await CryptoEngine.encryptString(rawData, newVaultKey);

          reEncryptedItems.push({
            id: item.id,
            service_name_encrypted: reEncService.ciphertext,
            service_name_iv: reEncService.iv,
            category: item.category,
            encrypted_data: reEncData.ciphertext,
            data_iv: reEncData.iv,
          });
        }
      }

      // Generate a brand new Recovery Key and encrypt new vault key with it
      const newRecoveryKey = CryptoEngine.generateRecoveryKey();
      const newEncryptedRecovery = await CryptoEngine.encryptVaultKeyWithRecovery(newVaultKey, newRecoveryKey);

      // Step 4: Send the new authentication hash, keys and re-encrypted items to server
      const recoverRes = await apiRequest('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({
          email,
          new_auth_hash: newAuthHash,
          new_auth_salt: newAuthSalt,
          new_vault_salt: newVaultSalt,
          new_recovery_encrypted_vault_key: newEncryptedRecovery.ciphertext,
          new_recovery_key_iv: newEncryptedRecovery.iv,
          re_encrypted_items: reEncryptedItems,
        }),
      });

      if (!recoverRes.success) {
        throw new Error(recoverRes.error || 'Erreur lors de la récupération.');
      }

      setNewlyGeneratedRecoveryKey(newRecoveryKey);
      setSuccessMessage('Votre coffre-fort a été déverrouillé, re-chiffré et votre mot de passe maître réinitialisé avec succès !');
      showToast('Récupération et re-chiffrement réussis !', 'success');
    } catch (err: any) {
      setError(err.message || 'Échec de la récupération.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-1">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Récupération de compte d'urgence
          </h1>
          <p className="text-xs text-slate-400 max-w-sm">
            Restaurez l'accès à votre coffre-fort grâce à votre clé de secours hors ligne sans perdre vos identifiants.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-5 text-center py-2 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Récupération terminée !</h3>
              <p className="text-xs text-slate-300 mt-1">{successMessage}</p>
            </div>

            {newlyGeneratedRecoveryKey && (
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700 text-left space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Votre nouvelle clé de secours générée</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl font-mono text-center text-xs sm:text-sm font-bold text-amber-400 tracking-wider select-all border border-slate-800 break-all">
                  {newlyGeneratedRecoveryKey}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={handleCopyRecoveryKey}
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copié !' : 'Copier la clé'}</span>
                  </button>
                  <button
                    onClick={handleDownloadRecoveryKey}
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger (.txt)</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  ⚠️ Sauvegardez précieusement cette nouvelle clé. Votre ancienne clé est désormais obsolète.
                </p>
              </div>
            )}

            <button
              onClick={onGoToLogin}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              Se connecter avec le nouveau mot de passe
            </button>
          </div>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Adresse e-mail du compte
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-white placeholder-slate-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Clé de secours d'urgence (Recovery Key)
              </label>
              <input
                type="text"
                value={recoveryKey}
                onChange={e => setRecoveryKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                required
                className="w-full px-3.5 py-2.5 text-sm font-mono tracking-wider bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-amber-400 placeholder-slate-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nouveau mot de passe maître (min. 12 car.)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newMasterPassword}
                  onChange={e => setNewMasterPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-white placeholder-slate-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={newMasterPassword} />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirmer le nouveau mot de passe maître
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-white placeholder-slate-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Déchiffrement et restauration en cours...' : 'Restaurer le compte'}</span>
            </button>
          </form>
        )}

        <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Si vous avez égaré à la fois votre mot de passe maître et votre clé de secours, la cryptographie asymétrique et symétrique employée rend vos données <strong>mathématiquement irrécupérables</strong>.
          </p>
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onGoToLogin}
            className="text-xs text-slate-400 hover:text-emerald-400 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à la connexion</span>
          </button>
        </div>
      </div>
    </div>
  );
};
