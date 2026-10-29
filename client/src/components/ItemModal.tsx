import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Wand2,
  Lock,
  Globe,
  User,
  FileText,
  Save,
  Check,
  Star,
  QrCode,
  Clock,
} from 'lucide-react';
import { DecryptedVaultItem, VaultCategory } from '../types/index.js';
import { useVault } from '../context/VaultContext.js';
import { useToast } from './Toast.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { PasswordStrengthMeter } from './PasswordStrengthMeter.js';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: DecryptedVaultItem | null;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  editItem,
}) => {
  const { addItem, updateItem } = useVault();
  const { showToast } = useToast();

  const [serviceName, setServiceName] = useState('');
  const [category, setCategory] = useState<VaultCategory>('other');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [totpPreview, setTotpPreview] = useState<{ code: string; secondsRemaining: number } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editItem) {
      setServiceName(editItem.service_name);
      setCategory(editItem.category);
      setUsername(editItem.username);
      setPassword(editItem.password);
      setUrl(editItem.url || '');
      setNotes(editItem.notes || '');
      setTotpSecret(editItem.totp_secret || '');
      setIsFavorite(!!editItem.favorite);
    } else {
      setServiceName('');
      setCategory('other');
      setUsername('');
      setPassword('');
      setUrl('');
      setNotes('');
      setTotpSecret('');
      setIsFavorite(false);
    }
    setError('');
    setShowPassword(false);
    setTotpPreview(null);
  }, [editItem, isOpen]);

  // Live TOTP preview calculation
  useEffect(() => {
    if (!totpSecret.trim()) {
      setTotpPreview(null);
      return;
    }
    let isCancelled = false;
    const calcTOTP = async () => {
      try {
        const res = await CryptoEngine.generateTOTP(totpSecret.trim());
        if (!isCancelled) setTotpPreview(res);
      } catch {
        if (!isCancelled) setTotpPreview(null);
      }
    };
    calcTOTP();
    const interval = setInterval(calcTOTP, 1000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [totpSecret]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const generated = CryptoEngine.generatePassword({
      length: 18,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true,
      excludeAmbiguous: true,
    });
    setPassword(generated);
    setShowPassword(true);
    showToast('Nouveau mot de passe robuste généré (CSPRNG)', 'success');
  };

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    showToast('Mot de passe copié dans le presse-papiers !', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setError('Le nom du service est requis.');
      return;
    }
    if (!password) {
      setError('Le mot de passe est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      if (editItem) {
        const res = await updateItem(editItem.id, {
          service_name: serviceName.trim(),
          category,
          username: username.trim(),
          password,
          url: url.trim(),
          notes: notes.trim(),
          totp_secret: totpSecret.trim() || undefined,
          favorite: isFavorite,
        });
        if (!res.success) throw new Error(res.error);
        showToast('Identifiant mis à jour avec succès.', 'success');
      } else {
        const res = await addItem({
          service_name: serviceName.trim(),
          category,
          username: username.trim(),
          password,
          url: url.trim(),
          notes: notes.trim(),
          totp_secret: totpSecret.trim() || undefined,
          favorite: isFavorite,
        });
        if (!res.success) throw new Error(res.error);
        showToast('Nouvel identifiant chiffré et enregistré !', 'success');
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'social', label: 'Réseaux sociaux' },
    { id: 'emails', label: 'E-mails' },
    { id: 'banks', label: 'Banques & Finances' },
    { id: 'work', label: 'Travail' },
    { id: 'studies', label: 'Études' },
    { id: 'other', label: 'Autres' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-slate-800 dark:text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base">
              {editItem ? 'Modifier l’identifiant' : 'Ajouter un identifiant sécurisé'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              title={isFavorite ? 'Retirer des favoris' : 'Marquer comme favori'}
              className={`p-1.5 rounded-lg transition-colors ${
                isFavorite
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Service Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nom du service *
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="Ex : Google, GitHub, BNP..."
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Catégorie
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as VaultCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Nom d’utilisateur ou adresse e-mail</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="alice@exemple.com"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none font-mono text-xs sm:text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Mot de passe *</span>
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                <span>Générer aléatoirement</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Saisissez ou générez un mot de passe"
                required
                className="w-full pl-3 pr-20 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none font-mono text-xs sm:text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  title="Copier le mot de passe"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Masquer' : 'Afficher'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>URL du site ou de l'application</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://github.com/login"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none text-xs sm:text-sm font-mono"
            />
          </div>

          {/* 2FA / TOTP Authenticator Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>Clé d’authentification 2FA / TOTP (Optionnel)</span>
              </label>
              {totpPreview && (
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3" />
                  <span>Code : {totpPreview.code} ({totpPreview.secondsRemaining}s)</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={totpSecret}
              onChange={e => setTotpSecret(e.target.value)}
              placeholder="Ex : JBSWY3DPEHPK3PXP ou otpauth://totp/..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none font-mono text-xs uppercase placeholder:normal-case"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Génère automatiquement les codes dynamiques à 6 chiffres dans votre coffre.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Notes confidentielles (facultatif)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Questions de sécurité, code PIN, indications de compte..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Chiffrement...' : editItem ? 'Enregistrer les modifications' : 'Chiffrer et enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
