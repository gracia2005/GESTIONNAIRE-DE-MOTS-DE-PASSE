import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../components/Toast.js';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter.js';
import { UserProfile } from '../types/index.js';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { register, completeRegistration } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery Key presentation screen
  const [createdRecoveryKey, setCreatedRecoveryKey] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ user: UserProfile; vaultKey: CryptoKey } | null>(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !masterPassword || !confirmPassword) {
      setError('Veuillez renseigner tous les champs.');
      return;
    }
    if (masterPassword.length < 12) {
      setError('Le mot de passe maître doit comporter au moins 12 caractères.');
      return;
    }
    if (masterPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const res = await register(email, masterPassword);
      if (!res.success) {
        setError(res.error || 'Erreur lors de l’inscription.');
      } else if (res.recoveryKey && res.user && res.vaultKey) {
        // Show recovery key screen before entering vault
        setCreatedRecoveryKey(res.recoveryKey);
        setPendingAuth({ user: res.user, vaultKey: res.vaultKey });
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’inscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRecoveryKey = () => {
    if (!createdRecoveryKey) return;
    navigator.clipboard.writeText(createdRecoveryKey);
    setCopiedKey(true);
    showToast('Clé de secours copiée dans le presse-papiers !', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadRecoveryKey = () => {
    if (!createdRecoveryKey) return;
    const content = `=====================================================
SECUREVAULT — CLÉ DE SECOURS D'URGENCE (RECOVERY KEY)
=====================================================
Compte : ${email}
Date de création : ${new Date().toISOString()}

VOTRE CLÉ DE SECOURS :
${createdRecoveryKey}

IMPORTANT :
- Conservez ce fichier dans un endroit sûr hors ligne (ex: clé USB chiffrée, coffre-fort physique).
- En cas d'oubli de votre mot de passe maître, cette clé est le SEUL moyen de déchiffrer votre coffre.
- Si vous perdez votre mot de passe maître ET cette clé, vos données sont DÉFINITIVEMENT IRRÉCUPÉRABLES.
=====================================================`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureVault-Recovery-Key-${email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Fichier de clé de secours téléchargé.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      {/* Recovery Key Presentation Modal/Step */}
      {createdRecoveryKey ? (
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-1">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Votre Clé de Secours d'Urgence
            </h2>
            <p className="text-xs text-slate-400 max-w-sm">
              En cas d'oubli de votre mot de passe maître, cette clé cryptographique unique est le <strong>seul moyen</strong> de restaurer l'accès à vos identifiants chiffrés.
            </p>
          </div>

          {/* Key Display Box */}
          <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700 space-y-3">
            <div className="p-3 bg-slate-900 rounded-xl font-mono text-center text-xs sm:text-sm font-bold text-amber-400 tracking-wider select-all border border-slate-800 break-all">
              {createdRecoveryKey}
            </div>

            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={handleCopyRecoveryKey}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copié !' : 'Copier la clé'}</span>
              </button>
              <button
                onClick={handleDownloadRecoveryKey}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger (.txt)</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <p>
              <strong>Avertissement Zero-Knowledge :</strong> Le serveur ne connaît ni votre mot de passe maître ni cette clé en clair. Si vous perdez les deux, aucune assistance technique ne pourra récupérer vos identifiants.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={hasSavedKey}
              onChange={e => setHasSavedKey(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs text-slate-300 select-none">
              J'ai bien noté ou téléchargé ma clé de secours dans un endroit sûr et hors ligne.
            </span>
          </label>

          <button
            onClick={() => {
              if (hasSavedKey && pendingAuth) {
                completeRegistration(pendingAuth.user, pendingAuth.vaultKey);
              }
            }}
            disabled={!hasSavedKey || !pendingAuth}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          >
            <span>Accéder à mon coffre-fort</span>
          </button>
        </div>
      ) : (
        /* Registration Form */
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white mb-1">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Créer mon SecureVault
            </h1>
            <p className="text-xs text-slate-400 max-w-xs">
              Chiffrement de bout en bout (Zero-Knowledge). Votre mot de passe maître ne quitte jamais votre appareil.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-white placeholder-slate-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Mot de passe maître (min. 12 caractères)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={e => setMasterPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  autoComplete="new-password"
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
              <PasswordStrengthMeter password={masterPassword} />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirmer le mot de passe maître
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  autoComplete="new-password"
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
              <span>{isSubmitting ? 'Génération des clés cryptographiques...' : 'Créer mon coffre-fort'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onGoToLogin}
              className="text-xs text-slate-400 hover:text-emerald-400 font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Déjà un compte ? Se connecter</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
