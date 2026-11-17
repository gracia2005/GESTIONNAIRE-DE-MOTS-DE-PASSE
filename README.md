# 🛡️ SecureVault — Gestionnaire de Mots de Passe Zero-Knowledge

**SecureVault** est un gestionnaire de mots de passe moderne, hautement sécurisé et conçu selon les normes les plus strictes de la cybersécurité (**ANSSI**, **NIST SP 800-132 / 800-63B**, **OWASP**).

Grâce à son architecture **Zero-Knowledge (Zéro Connaissance)**, le serveur ne stocke et ne reçoit **JAMAIS** le mot de passe maître en clair, la clé de déchiffrement du coffre ou les secrets de vos comptes. Toutes les opérations cryptographiques sont exécutées directement dans la mémoire volatile (RAM) de votre navigateur via l'API standard **Web Cryptography API (SubtleCrypto)**.

---

## 🔒 Principes Cryptographiques et Architecture

```
                    NAVIGATEUR DU CLIENT (RAM)                        |         SERVEUR D'API
                                                                      |
    [ Mot de passe maître ]                                           |
             |                                                        |
             +---> PBKDF2 (100 000 itérations, Sel Auth)  ───────────> [ auth_hash ] ──> bcrypt (coût 12) ──> [ Base de données ]
             |                                                        |
             +---> PBKDF2 (310 000 itérations, Sel Vault)             |
                         |                                            |
                         v                                            |
                 [ Clé du Coffre ] (CryptoKey en RAM)                 |
                         |                                            |
         +---------------+---------------+                            |
         |                               |                            |
         v                               v                            |
    AES-256-GCM                     AES-256-GCM                       |
(Chiffrement secrets)         (Clé de Secours 256-bit)                |
         |                               |                            |
         v                               v                            |
   [ Ciphertext + IV ]            [ Clé de secours ]                  |
         |                      (Format Base32 hors ligne)            |
         |                               |                            |
         +───────────────────────────────+───────────────────────────> [ Stockage Chiffré ]
                                                                      | (Aucun secret en clair)
```

### 1. Modèle Zero-Knowledge
- **Dérivation Séparée des Clés** : À partir du mot de passe maître, deux dérivés indépendants sont générés avec des sels cryptographiques distincts de 128 bits :
  - **`auth_hash`** : Envoyé au serveur pour l'authentification (dérivé avec 100 000 itérations de PBKDF2-HMAC-SHA256), puis haché côté serveur avec **bcrypt** (facteur de coût 12).
  - **`vault_key`** : Dérivée avec **310 000 itérations** de PBKDF2-HMAC-SHA256 (recommandation OWASP). Cette clé reste **strictement dans la RAM volatile** du client (`CryptoKey` non persistée sur disque ou LocalStorage).

### 2. Chiffrement Authentifié de Bout en Bout (AEAD)
- **Algorithme** : **AES-256-GCM** (Galois/Counter Mode).
- **Vecteur d'Initialisation (IV / Nonce)** : 96 bits générés aléatoirement par le CSPRNG (`crypto.getRandomValues`) pour chaque entrée.
- **Tag d'Authentification** : 128 bits garantissant l'intégrité et l'authenticité des données. Toute altération ou bit-flipping sur le ciphertext est immédiatement détecté et rejeté.

### 3. Clé de Secours d'Urgence (Emergency Recovery Key)
- Une clé cryptographique de **256 bits** générée aléatoirement via CSPRNG et formatée en Base32 lisible (`XXXX-XXXX-XXXX-...`).
- Permet de restaurer l'accès au coffre en cas d'oubli du mot de passe maître sans backdoor serveur.
- Lors de la récupération, les données du coffre sont déchiffrées en RAM avec l'ancienne clé et intégralement re-chiffrées avec le nouveau mot de passe maître.

### 4. Verrouillage Automatique & Sécurité en RAM (Auto-Lock)
- Surveillance des interactions de l'utilisateur (mouvements souris, clavier, défilement).
- Purge instantanée de la clé cryptographique en mémoire RAM après un délai d'inactivité configurable (1, 5, 15, 30 ou 60 minutes).

### 5. Défense en Profondeur (Serveur & Réseau)
- **Anti-Enumération de Comptes** : L'API `/api/auth/salts` génère des pseudo-sels déterministes par HMAC-SHA256 si l'e-mail n'existe pas, empêchant ainsi les attaquants de deviner quels e-mails sont inscrits.
- **Protection CSRF** : Validation stricte d'en-têtes personnalisés (`X-SecureVault-Client`) sur toutes les requêtes d'altération d'état.
- **Headers de Sécurité Helmet** : Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), X-Content-Type-Options: nosniff, X-Frame-Options: DENY.
- **Limitation de Débit (Rate Limiting)** : Protection anti force-brute sur l'authentification et les routes sensibles.
- **Journal d'Audit Sécurisé** : Traçabilité des connexions et modifications sans **aucun secret** (pas de mot de passe, clé ou identifiant en clair).

---

## 🚀 Fonctionnalités Principales

| Fonctionnalité | Description |
| :--- | :--- |
| **Coffre-fort d'identifiants** | Stockage chiffré AES-256-GCM avec tri par catégories (Réseaux, E-mails, Banques, Travail, Études, Autres). |
| **Authentificateur 2FA / TOTP** | Génération temps réel de codes TOTP RFC 6238 avec compte à rebours dynamique dans la mémoire RAM. |
| **Générateur de mots de passe** | Générateur CSPRNG conforme NIST, personnalisable (longueur 8-64, majuscules, minuscules, chiffres, symboles, exclusion des caractères ambigus). |
| **Audit de sécurité local** | Analyse locale d'entropie (Shannon), détection des mots de passe faibles, réutilisés ou incomplets, calcul d'un score de santé global. |
| **Sessions Actives & Contrôle d'Accès** | Visualisation détaillée des appareils connectés (OS, navigateur, IP, date), révocation ciblée et déconnexion en masse des sessions distantes. |
| **Exportation des données** | Exportation en **CSV** (compatible Excel / navigateurs) et **JSON** structuré. |
| **Importation sécurisée** | Import de fichiers `.csv` et `.json` avec chiffrement à la volée côté client. |
| **Kit d'Urgence Imprimable** | Génération d'une fiche physique imprimable contenant les instructions et la clé de secours hors ligne. |
| **Changement de mot de passe maître** | Re-chiffrement atomique de l'intégralité du coffre en RAM et émission d'une nouvelle clé de secours. |
| **Mode Sombre / Mode Clair** | Thème soigné et adaptatif avec persistance dans les préférences locales. |

---

## 📂 Architecture du Projet

```
GESTIONNAIRE DE MOTS DE PASSE/
├── client/                     # Interface utilisateur React 19 + TypeScript
│   ├── src/
│   │   ├── api/                # Client d'appel API Fetch avec credentials & CSRF
│   │   ├── components/         # Composants UI (Header, Sidebar, Modales, Toast, Jauge d'entropie)
│   │   ├── context/            # Contextes React (AuthContext, VaultContext, ThemeContext)
│   │   ├── crypto/             # Moteur cryptographique pur Web Crypto API (CryptoEngine)
│   │   ├── pages/              # Pages (Dashboard, Coffre, Audit, Générateur, Paramètres, Auth)
│   │   └── types/              # Définitions TypeScript
│   ├── package.json
│   └── vite.config.ts
│
├── electron/                   # Enveloppe Desktop native Electron (Windows, macOS, Linux)
│   ├── main.js                 # Processus principal, serveur local embarqué & verrouillage OS
│   └── preload.js              # Pont IPC sécurisé (contextIsolation)
│
├── build/                      # Ressources de packaging multi-OS (icônes SVG, PNG, ICO)
│
├── .github/workflows/          # Pipeline CI/CD GitHub Actions
│   └── release.yml             # Compilation & publication automatique des installateurs
│
├── server/                     # API Backend Express + TypeScript
│   ├── src/
│   │   ├── controllers/        # Contrôleurs métier (authController, vaultController, userController, auditController)
│   │   ├── db/                 # Couche base de données (JSON embarqué ou PostgreSQL)
│   │   ├── middleware/         # Middlewares sécurité (authentification, rate-limit, helmet, erreurs)
│   │   ├── routes/             # Définition des routes Express
│   │   ├── app.ts              # Configuration de l'application Express + service statique client
│   │   └── index.ts            # Point d'entrée exportant startServer()
│   ├── tests/                  # Suite de tests automatisés Vitest & Supertest
│   │   ├── auth.test.ts        # Tests d'authentification et Zero-Knowledge
│   │   ├── vault.test.ts       # Tests d'isolation et gestion du coffre
│   │   ├── security.test.ts    # Tests des en-têtes et protections CSRF / Injection
│   │   ├── sessions.test.ts    # Tests de gestion et révocation des sessions actives
│   │   └── e2e_vault_lifecycle.test.ts # Cycle de vie complet E2E (Chiffrement, Altération, Récupération)
│   └── package.json
│
├── package.json                # Scripts racine, dépendances et configuration electron-builder
└── README.md                   # Documentation technique du projet
```

---

## 💻 Téléchargement du Logiciel Multi-Plateforme (Desktop Autonome)

SecureVault est disponible en **application Desktop native autonome** (basée sur Electron) fonctionnant **100% hors-ligne** sans serveur externe ni base de données à installer :

| Système d'exploitation | Formats disponibles | Architecture |
| :--- | :--- | :--- |
| **Windows** | Installateur (`setup.exe`) & Exécutable autonome (`portable.exe`) | `x64` |
| **macOS** | Image disque (`.dmg`) & Archive (`.zip`) | `x64` (Intel) & `arm64` (Apple Silicon) |
| **Linux** | Paquet universel (`.AppImage`) & Paquet Debian/Ubuntu (`.deb`) | `x64` |

👉 **[Télécharger la dernière version sur GitHub Releases](https://github.com/gracia2005/GESTIONNAIRE-DE-MOTS-DE-PASSE/releases/latest)**

### Architecture Desktop Autonome
- **Serveur embarqué sur boucle locale** : Au lancement, Electron démarre le moteur Express strictement sur `127.0.0.1` (port `51730` ou port dynamique de repli) et sert l'interface compilée localement.
- **Stockage chiffré dans le profil système** : Le fichier `securevault.json` (et le secret de session `.session_secret`) est stocké dans le répertoire système `userData` de l'utilisateur (`%APPDATA%\securevault\data` sur Windows, `~/Library/Application Support/securevault/data` sur macOS, `~/.config/securevault/data` sur Linux) avec permissions restreintes (`0700`/`0600`).
- **Verrouillage système automatique** : Mise en veille, verrouillage de l'écran OS ou raccourci `Ctrl+L` / `Cmd+L` purgent immédiatement la clé maîtresse de la mémoire RAM.

---

## 🛠️ Installation et Démarrage

### Prérequis
- **Node.js** (v18 ou supérieur recommandé, v22 LTS pour le packaging Desktop)
- **npm** (v9 ou supérieur)

### 1. Installation des dépendances
À la racine du projet, installez les dépendances globales (Electron / `electron-builder`), du serveur et du client :
```bash
# Installation des dépendances racine (Electron + dépendances backend embarquées)
npm install

# Installation des dépendances du serveur
cd server && npm install

# Installation des dépendances du client
cd ../client && npm install
```

### 2. Configuration des variables d'environnement
Un fichier `.env` par défaut est présent dans le répertoire `server/` :
```env
PORT=5000
NODE_ENV=development
DB_DRIVER=sqlite
DB_SQLITE_PATH=./data/securevault.json
SESSION_SECRET=dev_secure_vault_super_secret_session_key_2026_safe
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
CLIENT_URL=http://localhost:5173
```

### 3. Lancer en mode Développement
Depuis la racine :
```bash
# Lancer simultanément le serveur et le client
npm run dev
```
Ou dans deux terminaux distincts :
- **Serveur API** :
  ```bash
  cd server
  npm run dev
  ```
  *(Disponible sur http://localhost:5000)*
- **Client Web** :
  ```bash
  cd client
  npm run dev
  ```
  *(Disponible sur http://localhost:5173)*

---

## 🧪 Tests Automatisés

Le projet comprend une suite complète de tests unitaires et d'intégration couvrant la cryptographie, l'authentification, les politiques de sécurité et le cycle de vie complet d'un coffre :

```bash
# Lancer les tests du moteur cryptographique client
cd client
npm test

# Lancer la suite de tests du serveur (25 tests d'intégration et E2E)
cd ../server
npm test
```

### Tests couverts :
1. **Tests Cryptographiques Côté Client (`cryptoEngine.test.ts`)** :
   - Dérivation PBKDF2 conforme
   - Chiffrement et déchiffrement AES-256-GCM
   - Détection de corruption du ciphertext (échec de l'étiquette AEAD)
   - Génération de clés de secours et restauration de la clé maîtresse
   - Évaluation de l'entropie de Shannon
2. **Tests d'Authentification & Anti-Énumération (`auth.test.ts`)**
3. **Tests de Sécurité & Headers (`security.test.ts`)** :
   - En-têtes Helmet (CSP, HSTS, no-sniff)
   - Rejet des requêtes sans en-tête CSRF
   - Résistance aux injections SQL
4. **Tests d'Isolation des Données (`vault.test.ts`)**
5. **Tests des Sessions Actives & Révocation (`sessions.test.ts`)** :
   - Établissement multi-sessions sécurisées
   - Marquage et identification de la session active
   - Révocation ciblée d'appareils distants
   - Déconnexion en masse des autres sessions
6. **Cycle de Vie Complet E2E (`e2e_vault_lifecycle.test.ts`)** :
   - Inscription Zero-Knowledge
   - Chiffrement client et vérification que la base de données ne contient aucun texte en clair
   - Détection de falsification (tamper resilience)
   - Récupération de compte avec clé de secours et re-chiffrement complet des entrées
   - Suppression sécurisée

---

## 🏗️ Compilation et Packaging Multi-OS

Pour générer les fichiers compilés optimisés (client + serveur) :
```bash
# Compiler le serveur et le client
npm run build
```

Les bundles de production sont générés dans :
- `client/dist/` (fichiers statiques HTML, CSS, JS optimisés)
- `server/dist/` (JavaScript Node.js compilé)

### Lancer l'application Desktop en local
```bash
npm run desktop:start
```

### Générer les installateurs par système d'exploitation (dans `release/`)
```bash
# Générer les paquets pour le système courant
npm run dist

# Générer pour Windows (.exe NSIS + Portable)
npm run dist:win

# Générer pour macOS (.dmg + .zip Intel/Apple Silicon, exécuté sur macOS)
npm run dist:mac

# Générer pour Linux (.AppImage + .deb)
npm run dist:linux
```

> Les releases officielles multi-OS sont également compilées et publiées automatiquement via GitHub Actions (`.github/workflows/release.yml`) sur `ubuntu-latest`, `windows-latest` et `macos-latest`.

---

## ⚖️ Licence
Projet sous licence MIT — Réalisé avec rigueur pour les standards de cybersécurité modernes.
