import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  Check,
  Globe,
  Mail,
  Building2,
  Briefcase,
  GraduationCap,
  FolderLock,
  Search,
  Star,
  QrCode,
  Clock,
} from 'lucide-react';
import { useVault } from '../context/VaultContext.js';
import { useToast } from '../components/Toast.js';
import { DecryptedVaultItem } from '../types/index.js';
import { CryptoEngine } from '../crypto/cryptoEngine.js';

interface VaultPageProps {
  onOpenAddItem: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
  onDeleteItem: (item: DecryptedVaultItem) => void;
}

const TotpBadge: React.FC<{ secret: string }> = ({ secret }) => {
  const [totp, setTotp] = useState<{ code: string; secondsRemaining: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const res = await CryptoEngine.generateTOTP(secret);
        if (active) setTotp(res);
      } catch {
        if (active) setTotp(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [secret]);

  if (!totp) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(totp.code);
    setCopied(true);
    showToast('Code 2FA (TOTP) copié !', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-2.5 p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
          <QrCode className="w-3 h-3" />
          <span>Code 2FA / TOTP</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-sm font-extrabold tracking-wider text-emerald-800 dark:text-emerald-300">
            {totp.code.slice(0, 3)} {totp.code.slice(3)}
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            <span>{totp.secondsRemaining}s</span>
          </span>
        </div>
      </div>
      <button
        onClick={handleCopy}
        title="Copier le code 2FA"
        className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

export const VaultPage: React.FC<VaultPageProps> = ({
  onOpenAddItem,
  onEditItem,
  onDeleteItem,
}) => {
  const {
    filteredItems,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    toggleFavorite,
    isLoading,
  } = useVault();
  const { showToast } = useToast();

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`${label} copié dans le presse-papiers`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const categories = [
    { id: 'all', label: 'Tous', icon: FolderLock },
    { id: 'favorites', label: 'Favoris', icon: Star },
    { id: 'social', label: 'Réseaux', icon: Globe },
    { id: 'emails', label: 'E-mails', icon: Mail },
    { id: 'banks', label: 'Banques', icon: Building2 },
    { id: 'work', label: 'Travail', icon: Briefcase },
    { id: 'studies', label: 'Études', icon: GraduationCap },
    { id: 'other', label: 'Autres', icon: FolderLock },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Mon coffre-fort</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
              {filteredItems.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Identifiants déchiffrés exclusivement en mémoire locale (RAM).
          </p>
        </div>

        <button
          onClick={onOpenAddItem}
          className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un identifiant</span>
        </button>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          Déchiffrement des données en cours...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 p-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            {searchQuery ? <Search className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">
            {searchQuery ? 'Aucun résultat trouvé' : 'Votre coffre est vide dans cette catégorie'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `Aucun identifiant ne correspond à votre recherche "${searchQuery}".`
              : 'Commencez à protéger vos comptes en créant un nouvel identifiant chiffré.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
            >
              Effacer la recherche
            </button>
          ) : (
            <button
              onClick={onOpenAddItem}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all"
            >
              Ajouter une entrée
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const isVisible = !!visiblePasswords[item.id];
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header of Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center shrink-0 uppercase border border-slate-200 dark:border-slate-700">
                        {item.service_name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {item.service_name}
                        </h4>
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium capitalize mt-0.5">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(item.id)}
                        title={item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.favorite
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${item.favorite ? 'fill-amber-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => onEditItem(item)}
                        title="Modifier"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item)}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Username Field */}
                  <div className="mb-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Identifiant</span>
                      <span className="block text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                        {item.username || '(Aucun)'}
                      </span>
                    </div>
                    {item.username && (
                      <button
                        onClick={() => handleCopy(item.username, `u_${item.id}`, 'Identifiant')}
                        title="Copier l'identifiant"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {copiedKey === `u_${item.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="mb-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Mot de passe</span>
                      <span className="block text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                        {isVisible ? item.password : '••••••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePasswordVisibility(item.id)}
                        title={isVisible ? 'Masquer' : 'Afficher'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(item.password, `p_${item.id}`, 'Mot de passe')}
                        title="Copier le mot de passe"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {copiedKey === `p_${item.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 2FA / TOTP Live Code Badge */}
                  {item.totp_secret && <TotpBadge secret={item.totp_secret} />}

                  {/* Notes Preview if available */}
                  {item.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-850/50 p-2 rounded-lg line-clamp-2 mb-2 italic">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* Footer with URL & Date */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  {item.url ? (
                    <a
                      href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Pas d’URL</span>
                  )}
                  <span className="font-mono text-[10px]">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
