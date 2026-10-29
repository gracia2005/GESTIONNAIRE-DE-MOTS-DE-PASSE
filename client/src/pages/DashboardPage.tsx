import React from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Repeat,
  Plus,
  ArrowUpRight,
  ExternalLink,
  Copy,
  Check,
  Wand2,
  Star,
  QrCode,
} from 'lucide-react';
import { useVault } from '../context/VaultContext.js';
import { useToast } from '../components/Toast.js';
import { DecryptedVaultItem } from '../types/index.js';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onOpenAddItem: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenAddItem,
  onEditItem,
}) => {
  const { items, auditResult } = useVault();
  const { showToast } = useToast();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`${type} copié dans le presse-papiers`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const recentItems = items.slice(0, 5);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 border border-slate-800 text-white shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            Tableau de bord sécurisé
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Toutes vos données sont chiffrées localement avec AES-256-GCM. Aucun serveur n'a accès à vos mots de passe en clair.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('generator')}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Générateur</span>
          </button>
          <button
            onClick={onOpenAddItem}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une entrée</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Identifiants */}
        <div
          onClick={() => onNavigate('vault')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total identifiants</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{items.length}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
              Consulter <ArrowUpRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Mots de passe faibles */}
        <div
          onClick={() => onNavigate('audit')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Mots de passe faibles</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{auditResult.weakCount}</span>
            <span className={`text-[11px] font-medium ${auditResult.weakCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {auditResult.weakCount > 0 ? 'À corriger' : 'Aucun'}
            </span>
          </div>
        </div>

        {/* Mots de passe réutilisés */}
        <div
          onClick={() => onNavigate('audit')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-red-500/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Mots de passe réutilisés</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{auditResult.reusedCount}</span>
            <span className={`text-[11px] font-medium ${auditResult.reusedCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {auditResult.reusedCount > 0 ? 'Risque de cascade' : 'Parfait'}
            </span>
          </div>
        </div>

        {/* Score de Sécurité Global */}
        <div
          onClick={() => onNavigate('audit')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Indice de santé globale</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{auditResult.overallScore}%</span>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getScoreColor(auditResult.overallScore)}`}>
              {auditResult.overallScore >= 80 ? 'Optimal' : auditResult.overallScore >= 50 ? 'Moyen' : 'Critique'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Section: Recent Items & Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Vault Entries */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Derniers identifiants ajoutés</h3>
              <p className="text-xs text-slate-400">Vos accès enregistrés les plus récents</p>
            </div>
            <button
              onClick={() => onNavigate('vault')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
            >
              <span>Voir tout</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <KeyRound className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs">Aucun identifiant pour le moment.</p>
              <button
                onClick={onOpenAddItem}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100"
              >
                Créer votre premier identifiant
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentItems.map(item => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850/50 px-2 rounded-xl transition-colors"
                >
                  <div
                    onClick={() => onEditItem(item)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {item.service_name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {item.service_name}
                        </span>
                        {item.favorite && (
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        {item.totp_secret && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                            <QrCode className="w-2.5 h-2.5 shrink-0" />
                            <span>2FA</span>
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium capitalize">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{item.username || 'Sans nom d’utilisateur'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    {item.url && (
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir le site"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleCopy(item.username, `user_${item.id}`, 'Nom d’utilisateur')}
                      title="Copier l'identifiant"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {copiedId === `user_${item.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(item.password, `pwd_${item.id}`, 'Mot de passe')}
                      title="Copier le mot de passe"
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                    >
                      {copiedId === `pwd_${item.id}` ? 'Copié !' : 'Copier mot de passe'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Overview Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Garanties de sécurité</h3>
              <p className="text-[11px] text-slate-400">Architecture Zero-Knowledge</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">🔐 Dérivation de clé</p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                PBKDF2-HMAC-SHA256 avec 310 000 itérations et un sel cryptographique unique de 128 bits.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">🛡️ Chiffrement Authentifié</p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                AES-256-GCM avec nonce aléatoire de 96 bits à chaque écriture et tag d'intégrité de 128 bits.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">⏳ Auto-Verrouillage</p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Purge automatique de la clé maîtresse en mémoire vive après inactivité.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('audit')}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Lancer un audit approfondi</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
