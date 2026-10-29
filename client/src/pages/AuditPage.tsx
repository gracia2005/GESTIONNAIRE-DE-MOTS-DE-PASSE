import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Repeat,
  FileQuestion,
  ArrowRight,
  Info,
  CheckCircle2,
  Flame,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useVault } from '../context/VaultContext.js';
import { DecryptedVaultItem } from '../types/index.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';
import { useToast } from '../components/Toast.js';

interface AuditPageProps {
  onEditItem: (item: DecryptedVaultItem) => void;
}

export const AuditPage: React.FC<AuditPageProps> = ({ onEditItem }) => {
  const { auditResult, items } = useVault();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'breached' | 'weak' | 'reused' | 'incomplete'>('all');

  // Breach checking state (k-Anonymity)
  const [isCheckingBreaches, setIsCheckingBreaches] = useState(false);
  const [breachedItems, setBreachedItems] = useState<{ item: DecryptedVaultItem; count: number }[]>([]);
  const [breachCheckDone, setBreachCheckDone] = useState(false);

  const handleRunBreachCheck = async () => {
    if (items.length === 0) {
      showToast('Votre coffre est vide.', 'info');
      return;
    }

    try {
      setIsCheckingBreaches(true);
      const found: { item: DecryptedVaultItem; count: number }[] = [];

      for (const item of items) {
        const res = await CryptoEngine.checkPasswordBreach(item.password);
        if (res.breached) {
          found.push({ item, count: res.count });
        }
      }

      setBreachedItems(found);
      setBreachCheckDone(true);
      if (found.length > 0) {
        showToast(`Attention : ${found.length} mot(s) de passe compromis détecté(s) !`, 'error');
        setActiveTab('breached');
      } else {
        showToast('Excellent ! Aucun de vos mots de passe ne figure dans les fuites connues.', 'success');
      }
    } catch {
      showToast('Erreur lors de la vérification des fuites.', 'error');
    } finally {
      setIsCheckingBreaches(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-emerald-500" />
          <span>Audit de sécurité local du coffre</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Analyse cryptographique 100% exécutée dans votre navigateur. Aucun mot de passe n'est transmis à un service externe.
        </p>
      </div>

      {/* Score Card Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center gap-6">
        {/* Circular Gauge / Score Display */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="52"
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-100 dark:text-slate-800"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r="52"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={326.7}
              strokeDashoffset={326.7 - (326.7 * auditResult.overallScore) / 100}
              strokeLinecap="round"
              className={`${getScoreColor(auditResult.overallScore)} transition-all duration-1000`}
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-extrabold ${getScoreColor(auditResult.overallScore)}`}>
              {auditResult.overallScore}%
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Santé
            </span>
          </div>
        </div>

        {/* Breakdown Text */}
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {auditResult.overallScore >= 80
              ? 'Excellent niveau de sécurité'
              : auditResult.overallScore >= 50
              ? 'Niveau de sécurité moyen — Des améliorations sont requises'
              : 'Vulnérabilités critiques détectées'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            L'indice de santé est calculé selon les recommandations de l'ANSSI : analyse d'entropie, détection de réutilisation de secrets et exhaustivité des métadonnées (URL, noms de compte).
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>{items.length} comptes audités</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{auditResult.weakCount} mots de passe faibles</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>{auditResult.reusedCount} réutilisations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breach Checker Banner (k-Anonymity) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-red-950/40 border border-red-900/30 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-rose-400 font-bold text-sm">
            <Flame className="w-4 h-4" />
            <span>Détection de fuites de données (k-Anonymity)</span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Vérifiez si vos mots de passe ont été divulgués lors de cyberattaques publiques mondiales. Protégé par k-Anonymity : seuls 5 caractères du hash SHA-1 sont interrogés.
          </p>
        </div>

        <button
          onClick={handleRunBreachCheck}
          disabled={isCheckingBreaches || items.length === 0}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50 shrink-0 transition-all"
        >
          {isCheckingBreaches ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyse des fuites...</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>{breachCheckDone ? 'Re-vérifier les fuites' : 'Vérifier les fuites publiques'}</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Tous les avertissements ({auditResult.weakCount + auditResult.reusedCount + auditResult.missingDataCount + breachedItems.length})
        </button>
        {breachedItems.length > 0 && (
          <button
            onClick={() => setActiveTab('breached')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'breached'
                ? 'bg-rose-600 text-white'
                : 'text-rose-500 hover:text-rose-700 dark:hover:text-rose-300'
            }`}
          >
            Fuites détectées ({breachedItems.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('weak')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'weak'
              ? 'bg-amber-600 text-white'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Mots de passe faibles ({auditResult.weakCount})
        </button>
        <button
          onClick={() => setActiveTab('reused')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'reused'
              ? 'bg-red-600 text-white'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Réutilisations ({auditResult.reusedCount})
        </button>
        <button
          onClick={() => setActiveTab('incomplete')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'incomplete'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Incomplets ({auditResult.missingDataCount})
        </button>
      </div>

      {/* Audit Findings List */}
      <div className="space-y-4">
        {/* Section: Breached Passwords */}
        {(activeTab === 'all' || activeTab === 'breached') && breachedItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              <span>Mots de passe compromis dans des violations publiques</span>
            </h4>
            <div className="space-y-2">
              {breachedItems.map(({ item, count }) => (
                <div
                  key={`breach_${item.id}`}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {item.service_name}
                      </h5>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        Apparu {count.toLocaleString()} fois
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{item.username}</p>
                    <p className="text-[11px] text-rose-500 font-medium mt-1">
                      Ce mot de passe figure dans des bases de données piratées publiques. Changez-le immédiatement !
                    </p>
                  </div>
                  <button
                    onClick={() => onEditItem(item)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 shrink-0 shadow-md shadow-rose-600/20 transition-all"
                  >
                    <span>Renouveler</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Section: Weak Passwords */}
        {(activeTab === 'all' || activeTab === 'weak') && auditResult.weakItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Mots de passe faibles ou trop courts</span>
            </h4>
            <div className="space-y-2">
              {auditResult.weakItems.map(({ item, reason }) => (
                <div
                  key={`weak_${item.id}`}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                        {item.service_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">({item.username})</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">⚠️ {reason}</p>
                  </div>
                  <button
                    onClick={() => onEditItem(item)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 flex items-center gap-1 shrink-0"
                  >
                    <span>Renforcer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Reused Passwords */}
        {(activeTab === 'all' || activeTab === 'reused') && auditResult.reusedGroups.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <Repeat className="w-4 h-4" />
              <span>Mots de passe réutilisés sur plusieurs comptes</span>
            </h4>
            <div className="space-y-3">
              {auditResult.reusedGroups.map((group, gIdx) => (
                <div
                  key={gIdx}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs text-red-500 font-medium">
                      Ce mot de passe est partagé par {group.items.length} comptes différents :
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-600">
                      Risque de compromission en cascade
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {item.service_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{item.username}</p>
                        </div>
                        <button
                          onClick={() => onEditItem(item)}
                          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                        >
                          Changer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Incomplete Entries */}
        {(activeTab === 'all' || activeTab === 'incomplete') && auditResult.missingDataItems.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <FileQuestion className="w-4 h-4" />
              <span>Entrées incomplètes (URL ou identifiant manquant)</span>
            </h4>
            <div className="space-y-2">
              {auditResult.missingDataItems.map(({ item, issues }) => (
                <div
                  key={`inc_${item.id}`}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div>
                    <h5 className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                      {item.service_name}
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">{issues.join(' • ')}</p>
                  </div>
                  <button
                    onClick={() => onEditItem(item)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1 shrink-0"
                  >
                    <span>Compléter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clean State */}
        {auditResult.weakCount === 0 &&
          auditResult.reusedCount === 0 &&
          auditResult.missingDataCount === 0 && (
            <div className="py-16 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">
                Félicitations ! Aucun défaut de sécurité détecté
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tous vos mots de passe respectent les seuils d'entropie recommandés, aucun mot de passe n'est réutilisé et toutes les entrées sont complètes.
              </p>
            </div>
          )}
      </div>

      {/* Educational Box for Defense */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-xs space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
          <Info className="w-4 h-4" />
          <span>Fiche Technique — Méthode de Calcul pour la Présentation</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          <strong>Formule du Score Global :</strong> Le score part d'une base de 100%. Des pénalités pondérées sont appliquées en fonction du nombre total d'entrées chiffrées :
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[11px] pl-2">
          <li>Pénalité Mot de Passe Faible : -12 points par mot de passe &lt; 12 caractères ou entropie &lt; 60 bits</li>
          <li>Pénalité Réutilisation : -10 points par compte partageant un mot de passe déjà utilisé</li>
          <li>Pénalité Métadonnée Manquante : -4 points par entrée sans URL ou sans nom d'utilisateur</li>
        </ul>
        <p className="text-[11px] text-emerald-400 font-medium">
          Note de sécurité : L'analyse d'égalité des mots de passe s'effectue dans une table de correspondance éphémère en mémoire RAM (Heap V8), détruite au verrouillage du coffre.
        </p>
      </div>
    </div>
  );
};
