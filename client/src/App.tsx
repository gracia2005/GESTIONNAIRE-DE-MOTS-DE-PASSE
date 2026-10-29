import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { VaultProvider, useVault } from './context/VaultContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider, useToast } from './components/Toast.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { UnlockModal } from './components/UnlockModal.js';
import { ItemModal } from './components/ItemModal.js';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { VaultPage } from './pages/VaultPage.js';
import { GeneratorPage } from './pages/GeneratorPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { RecoveryPage } from './pages/RecoveryPage.js';
import { DecryptedVaultItem } from './types/index.js';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLocked, isLoading } = useAuth();
  const { deleteItem } = useVault();
  const { showToast } = useToast();

  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register' | 'recovery'>('login');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DecryptedVaultItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<DecryptedVaultItem | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Chargement sécurisé de SecureVault...</p>
      </div>
    );
  }

  // Unauthenticated screens
  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage onGoToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'recovery') {
      return <RecoveryPage onGoToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginPage
        onGoToRegister={() => setAuthView('register')}
        onGoToRecovery={() => setAuthView('recovery')}
      />
    );
  }

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: DecryptedVaultItem) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleDeleteItem = (item: DecryptedVaultItem) => {
    setDeletingItem(item);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const res = await deleteItem(deletingItem.id);
    if (res.success) {
      showToast(`Identifiant pour "${deletingItem.service_name}" supprimé.`, 'info');
    } else {
      showToast(res.error || 'Erreur de suppression.', 'error');
    }
    setDeletingItem(null);
  };

  return (
    <div className="min-h-screen bg-ivory-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenAddItem={handleOpenAddItem}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentPage}
              onOpenAddItem={handleOpenAddItem}
              onEditItem={handleEditItem}
            />
          )}
          {currentPage === 'vault' && (
            <VaultPage
              onOpenAddItem={handleOpenAddItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          )}
          {currentPage === 'generator' && <GeneratorPage />}
          {currentPage === 'audit' && <AuditPage onEditItem={handleEditItem} />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Unlock Modal when Auto-Locked */}
      {isLocked && <UnlockModal onGoToRecovery={() => setAuthView('recovery')} />}

      {/* Item Modal (Add / Edit) */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        editItem={editingItem}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        serviceName={deletingItem?.service_name || ''}
      />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <VaultProvider>
            <MainLayout />
          </VaultProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
