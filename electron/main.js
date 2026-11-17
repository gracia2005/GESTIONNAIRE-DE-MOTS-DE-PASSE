const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  powerMonitor,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Required on modern Linux kernels / AppImage / Ubuntu 24.04+ when unprivileged user namespaces are restricted
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow = null;
let httpServer = null;
let activePort = null;
let dataDirPath = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function configureEnvironment() {
  const userDataPath = app.getPath('userData');
  dataDirPath = path.join(userDataPath, 'data');
  fs.mkdirSync(dataDirPath, { recursive: true, mode: 0o700 });

  const secretFile = path.join(dataDirPath, '.session_secret');
  let sessionSecret = '';
  if (fs.existsSync(secretFile)) {
    try {
      sessionSecret = fs.readFileSync(secretFile, 'utf8').trim();
    } catch {
      sessionSecret = '';
    }
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, sessionSecret, { encoding: 'utf8', mode: 0o600 });
  }

  process.env.NODE_ENV = 'production';
  process.env.ELECTRON_APP = 'true';
  process.env.DB_DRIVER = 'sqlite';
  process.env.DB_SQLITE_PATH = path.join(dataDirPath, 'securevault.json');
  process.env.SESSION_SECRET = sessionSecret;
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_SAME_SITE = 'lax';
  process.env.CLIENT_DIST_PATH = path.join(__dirname, '..', 'client', 'dist');
  process.env.CLIENT_URL = 'http://127.0.0.1:51730';
}

function triggerVaultLock() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('securevault:system-lock');
  }
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'À propos de SecureVault' },
              { type: 'separator' },
              { role: 'services', label: 'Services' },
              { type: 'separator' },
              { role: 'hide', label: 'Masquer SecureVault' },
              { role: 'hideOthers', label: 'Masquer les autres' },
              { role: 'unhide', label: 'Tout afficher' },
              { type: 'separator' },
              { role: 'quit', label: 'Quitter SecureVault' },
            ],
          },
        ]
      : []),
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir le dossier du coffre chiffré',
          click: () => {
            if (dataDirPath) shell.openPath(dataDirPath);
          },
        },
        { type: 'separator' },
        isMac
          ? { role: 'close', label: 'Fermer la fenêtre' }
          : { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Actualiser' },
        { role: 'forceReload', label: 'Forcer l’actualisation' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        ...(!app.isPackaged ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Outils de développement' }] : []),
      ],
    },
    {
      label: 'Sécurité',
      submenu: [
        {
          label: 'Verrouiller le coffre-fort',
          accelerator: 'CmdOrCtrl+L',
          click: () => triggerVaultLock(),
        },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos de SecureVault',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos de SecureVault',
              message: `SecureVault v${app.getVersion()}`,
              detail:
                `Gestionnaire de mots de passe Zero-Knowledge (AES-256-GCM & PBKDF2).\n` +
                `Mode Desktop Autonome — Hors-ligne.\n\n` +
                `Emplacement du coffre :\n${process.env.DB_SQLITE_PATH || ''}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow(port) {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    title: 'SecureVault — Coffre-fort Zero-Knowledge',
    backgroundColor: '#020617',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Allow blank popups (used by printable Emergency Kit) and route external URLs to OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') {
      return { action: 'allow' };
    }
    const localBase = `http://127.0.0.1:${port}`;
    if (url.startsWith(localBase)) {
      return { action: 'allow' };
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.loadURL(`http://127.0.0.1:${port}`);
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  mainWindow = win;
}

async function bootDesktopApp() {
  configureEnvironment();

  const { startServer } = require(path.join(__dirname, '..', 'server', 'dist', 'index.js'));

  try {
    const started = await startServer(51730, '127.0.0.1');
    httpServer = started.server;
    activePort = started.port;
  } catch {
    const started = await startServer(0, '127.0.0.1');
    httpServer = started.server;
    activePort = started.port;
  }

  ipcMain.handle('desktop:get-info', async () => ({
    isDesktop: true,
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    vaultPath: process.env.DB_SQLITE_PATH,
    dataDir: dataDirPath,
  }));

  ipcMain.handle('desktop:open-data-folder', async () => {
    if (dataDirPath) {
      await shell.openPath(dataDirPath);
      return { success: true };
    }
    return { success: false };
  });

  powerMonitor.on('suspend', triggerVaultLock);
  powerMonitor.on('lock-screen', triggerVaultLock);

  buildAppMenu();
  createWindow(activePort);
}

if (gotTheLock) {
  app.whenReady().then(() => {
    bootDesktopApp().catch((err) => {
      console.error('Fatal desktop startup error:', err);
      dialog.showErrorBox(
        'Erreur de démarrage SecureVault',
        `Impossible de démarrer le moteur local sécurisé :\n${err && err.message ? err.message : String(err)}`
      );
      app.quit();
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && activePort) {
      createWindow(activePort);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (httpServer) {
      try {
        httpServer.close();
      } catch {
        // Ignore close errors during shutdown
      }
    }
  });
}
