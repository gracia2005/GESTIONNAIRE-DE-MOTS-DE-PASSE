import React from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  KeyRound,
  Wand2,
  ShieldAlert,
  Settings,
  Lock,
  Globe,
  Mail,
  Building2,
  Briefcase,
  GraduationCap,
  FolderLock,
  LogOut,
  X,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useVault } from '../context/VaultContext.js';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpen,
  onClose,
}) => {
  const { user, lock, logout } = useAuth();
  const { items, selectedCategory, setSelectedCategory } = useVault();

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'vault', label: 'Mon coffre', icon: KeyRound, count: items.length },
    { id: 'generator', label: 'Générateur', icon: Wand2 },
    { id: 'audit', label: 'Audit de sécurité', icon: ShieldAlert },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const categories = [
    { id: 'all', label: 'Toutes les catégories', icon: FolderLock },
    { id: 'favorites', label: 'Favoris', icon: Star },
    { id: 'social', label: 'Réseaux sociaux', icon: Globe },
    { id: 'emails', label: 'E-mails', icon: Mail },
    { id: 'banks', label: 'Banques & Finances', icon: Building2 },
    { id: 'work', label: 'Travail', icon: Briefcase },
    { id: 'studies', label: 'Études', icon: GraduationCap },
    { id: 'other', label: 'Autres', icon: FolderLock },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
                SecureVault
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Zero-Knowledge Vault</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Menu Principal
            </p>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Categories Quick Filter */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Catégories du coffre
            </p>
            {categories.map(cat => {
              const Icon = cat.icon;
              const isCatActive = currentPage === 'vault' && selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? items.length
                  : items.filter(i => i.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    onNavigate('vault');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCatActive
                      ? 'bg-slate-800 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security Status & Quick Actions */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="truncate text-left">
                <p className="text-[11px] font-medium text-slate-200 truncate">{user?.email}</p>
                <p className="text-[10px] text-emerald-400">Chiffrement AES-256 actif</p>
              </div>
            </div>
            <button
              onClick={lock}
              title="Verrouiller manuellement le coffre"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <Lock className="w-4 h-4 text-amber-400" />
            </button>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
};
