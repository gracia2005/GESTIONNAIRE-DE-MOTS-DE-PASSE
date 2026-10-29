/**
 * ============================================================================
 * SECUREVAULT — MOTEUR CRYPTOGRAPHIQUE CLIENT (ZERO-KNOWLEDGE)
 * ============================================================================
 * Ce module implémente la cryptographie côté client conforme aux recommandations
 * de l'ANSSI, du NIST et de l'OWASP.
 * 
 * Principes fondamentaux :
 * 1. ZERO-KNOWLEDGE : Le serveur ne reçoit JAMAIS le mot de passe maître en clair
 *    ni la clé de chiffrement du coffre.
 * 2. DÉRIVATION SÉPARÉE : Deux dérivés distincts sont générés avec des sels différents :
 *    - Auth Hash : envoyé au serveur pour l'authentification (ensuite haché avec bcrypt côté serveur).
 *    - Vault Key : conservée strictement dans la RAM du client pour chiffrer/déchiffrer les données.
 * 3. CHIFFREMENT AUTHENTIFIÉ (AEAD) : AES-256-GCM avec nonce/IV unique de 96 bits par entrée.
 * 4. GÉNÉRATEUR ALÉATOIRE SÉCURISÉ : Web Crypto API (CSPRNG window.crypto.getRandomValues).
 * ============================================================================
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64
}

export interface VaultSecretData {
  username: string;
  password: string;
  url?: string;
  notes?: string;
  totp_secret?: string;
  favorite?: boolean;
}

export interface PasswordGeneratorOptions {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  excludeAmbiguous: boolean;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export interface PasswordStrength {
  score: number; // 0 to 100
  entropy: number; // bits
  label: 'Très faible' | 'Faible' | 'Moyen' | 'Fort' | 'Excellent';
  feedback: string[];
}

export class CryptoEngine {
  private static get subtle(): SubtleCrypto {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error('Web Cryptography API (SubtleCrypto) non disponible.');
  }

  private static getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(bytes);
    } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      throw new Error('CSPRNG non disponible.');
    }
    return bytes;
  }

  // --- Encodage / Décodage Utilitaires ---

  public static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public static base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  public static bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public static hexToBuffer(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  // --- Sels Cryptographiques ---

  public static generateSaltHex(): string {
    return this.bufferToHex(this.getRandomBytes(16)); // 128-bit salt
  }

  // --- Dérivation de Clés (PBKDF2-HMAC-SHA256) ---

  /**
   * Dérive le Auth Hash envoyé au serveur pour l'authentification.
   * Utilise 100 000 itérations de PBKDF2 avec SHA-256.
   */
  public static async deriveAuthHash(masterPassword: string, authSaltHex: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await this.subtle.importKey(
      'raw',
      enc.encode(masterPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const saltBuffer = this.hexToBuffer(authSaltHex) as unknown as BufferSource;
    const derivedBits = await this.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256 // 32 bytes (256 bits)
    );

    return this.bufferToHex(derivedBits);
  }

  /**
   * Dérive la clé maîtresse de chiffrement du coffre (Vault Key).
   * Utilise 310 000 itérations de PBKDF2-SHA256 (recommandation OWASP).
   * La clé reste strictement stockée en mémoire volatile (CryptoKey).
   */
  public static async deriveVaultKey(masterPassword: string, vaultSaltHex: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await this.subtle.importKey(
      'raw',
      enc.encode(masterPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const saltBuffer = this.hexToBuffer(vaultSaltHex) as unknown as BufferSource;
    return await this.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 310000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for recovery backup only
      ['encrypt', 'decrypt']
    );
  }

  // --- Chiffrement & Déchiffrement AES-256-GCM ---

  /**
   * Chiffre une chaîne de caractères en clair avec AES-256-GCM.
   * Génère un nouveau vecteur d'initialisation (IV / Nonce) de 96 bits aléatoire à chaque appel.
   */
  public static async encryptString(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
    const iv = this.getRandomBytes(12); // 96 bits recommandé pour GCM
    const enc = new TextEncoder();
    const data = enc.encode(plaintext);

    const ciphertextBuffer = await this.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128, // Authenticated tag 128 bits
      },
      key,
      data
    );

    return {
      ciphertext: this.bufferToBase64(ciphertextBuffer),
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Déchiffre une chaîne chiffrée avec AES-256-GCM et valide son tag d'intégrité.
   * Lève une exception si le texte a été altéré ou la clé incorrecte.
   */
  public static async decryptString(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
    const ciphertext = this.base64ToBuffer(payload.ciphertext);
    const iv = this.base64ToBuffer(payload.iv);

    const decryptedBuffer = await this.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  }

  /**
   * Chiffre l'objet secret complet d'un identifiant (nom d'utilisateur, mot de passe, URL, notes).
   */
  public static async encryptVaultData(secretData: VaultSecretData, key: CryptoKey): Promise<EncryptedPayload> {
    const jsonString = JSON.stringify(secretData);
    return await this.encryptString(jsonString, key);
  }

  /**
   * Déchiffre l'objet secret complet d'un identifiant.
   */
  public static async decryptVaultData(payload: EncryptedPayload, key: CryptoKey): Promise<VaultSecretData> {
    const jsonString = await this.decryptString(payload, key);
    return JSON.parse(jsonString) as VaultSecretData;
  }

  // --- Clé de Secours d'Urgence (Emergency Recovery Key) ---

  /**
   * Génère une clé de secours cryptographique aléatoire de 256 bits,
   * formatée en 8 groupes de 4 caractères pour être lisible et recopiable.
   * Ex: "A8F9-2K9P-M4T7-X9L2-B3Q8-W5R1-V7Y4-C2Z6"
   */
  public static generateRecoveryKey(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 sans caractères ambigus (0, 1, I, O)
    const bytes = this.getRandomBytes(32);
    let key = '';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += chars[bytes[i] % chars.length];
    }
    return key;
  }

  /**
   * Chiffre la clé maîtresse du coffre avec la clé de secours.
   */
  public static async encryptVaultKeyWithRecovery(vaultKey: CryptoKey, recoveryKeyString: string): Promise<EncryptedPayload> {
    const cleanKey = recoveryKeyString.replace(/-/g, '').toUpperCase();
    const enc = new TextEncoder();
    const hashBuffer = await this.subtle.digest('SHA-256', enc.encode(cleanKey));
    
    const recoveryCryptoKey = await this.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    const exportedVaultKeyRaw = await this.subtle.exportKey('raw', vaultKey);
    const iv = this.getRandomBytes(12);

    const encryptedKeyBuffer = await this.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      recoveryCryptoKey,
      exportedVaultKeyRaw
    );

    return {
      ciphertext: this.bufferToBase64(encryptedKeyBuffer),
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Déchiffre la clé maîtresse du coffre à partir de la clé de secours.
   */
  public static async decryptVaultKeyWithRecovery(
    encryptedPayload: EncryptedPayload,
    recoveryKeyString: string
  ): Promise<CryptoKey> {
    const cleanKey = recoveryKeyString.replace(/-/g, '').toUpperCase();
    const enc = new TextEncoder();
    const hashBuffer = await this.subtle.digest('SHA-256', enc.encode(cleanKey));

    const recoveryCryptoKey = await this.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertext = this.base64ToBuffer(encryptedPayload.ciphertext);
    const iv = this.base64ToBuffer(encryptedPayload.iv);

    const rawVaultKey = await this.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      recoveryCryptoKey,
      ciphertext as unknown as BufferSource
    );

    return await this.subtle.importKey(
      'raw',
      rawVaultKey,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // --- Générateur de Mots de Passe Cryptographiquement Sûr (CSPRNG) ---

  public static generatePassword(options: PasswordGeneratorOptions): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const upperClean = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowerClean = 'abcdefghijkmnopqrstuvwxyz';
    const numbersClean = '23456789';
    const symbolsClean = '!@#$%^&*()_+-=?';

    let pool = '';
    const guaranteed: string[] = [];

    const u = options.excludeAmbiguous ? upperClean : upper;
    const l = options.excludeAmbiguous ? lowerClean : lower;
    const n = options.excludeAmbiguous ? numbersClean : numbers;
    const s = options.excludeAmbiguous ? symbolsClean : symbols;

    if (options.useUpper) {
      pool += u;
      guaranteed.push(this.pickRandomChar(u));
    }
    if (options.useLower) {
      pool += l;
      guaranteed.push(this.pickRandomChar(l));
    }
    if (options.useNumbers) {
      pool += n;
      guaranteed.push(this.pickRandomChar(n));
    }
    if (options.useSymbols) {
      pool += s;
      guaranteed.push(this.pickRandomChar(s));
    }

    if (!pool) {
      pool = l + n;
      guaranteed.push(this.pickRandomChar(l));
      guaranteed.push(this.pickRandomChar(n));
    }

    const length = Math.max(8, Math.min(64, options.length));
    const remainingCount = Math.max(0, length - guaranteed.length);
    const randomChars: string[] = [];

    // CSPRNG bytes
    const randomBytes = this.getRandomBytes(remainingCount);
    for (let i = 0; i < remainingCount; i++) {
      randomChars.push(pool[randomBytes[i] % pool.length]);
    }

    const allChars = [...guaranteed, ...randomChars];

    // Fisher-Yates shuffle avec CSPRNG
    const shuffleBytes = this.getRandomBytes(allChars.length);
    for (let i = allChars.length - 1; i > 0; i--) {
      const j = shuffleBytes[i] % (i + 1);
      const temp = allChars[i];
      allChars[i] = allChars[j];
      allChars[j] = temp;
    }

    return allChars.join('');
  }

  private static pickRandomChar(charset: string): string {
    const bytes = this.getRandomBytes(1);
    return charset[bytes[0] % charset.length];
  }

  // --- Audit & Calcul de Robustesse (Local RAM uniquement) ---

  /**
   * Évalue la robustesse d'un mot de passe (entropie de Shannon + diversité).
   * Ne communique JAMAIS avec un serveur extérieur.
   */
  public static evaluatePasswordStrength(password: string): PasswordStrength {
    if (!password) {
      return { score: 0, entropy: 0, label: 'Très faible', feedback: ['Le mot de passe est vide.'] };
    }

    let poolSize = 0;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (hasUpper) poolSize += 26;
    if (hasLower) poolSize += 26;
    if (hasNumber) poolSize += 10;
    if (hasSymbol) poolSize += 33;

    // Entropie théorique E = L * log2(poolSize)
    const entropy = poolSize > 0 ? Math.round(password.length * Math.log2(poolSize)) : 0;

    const feedback: string[] = [];
    if (password.length < 12) feedback.push('Longueur inférieure à 12 caractères recommandée.');
    if (!hasUpper) feedback.push('Ajoutez des lettres majuscules.');
    if (!hasLower) feedback.push('Ajoutez des lettres minuscules.');
    if (!hasNumber) feedback.push('Ajoutez des chiffres.');
    if (!hasSymbol) feedback.push('Ajoutez des caractères spéciaux.');

    // Détection de répétitions évidentes
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Évitez les caractères répétés consécutifs.');
    }

    let score = 0;
    if (entropy < 28) score = 15;
    else if (entropy < 45) score = 35;
    else if (entropy < 65) score = 60;
    else if (entropy < 85) score = 85;
    else score = 100;

    // Bonus / pénalités
    if (password.length >= 16) score = Math.min(100, score + 10);
    if (password.length < 8) score = Math.min(score, 10);

    let label: PasswordStrength['label'] = 'Moyen';
    if (score < 25) label = 'Très faible';
    else if (score < 50) label = 'Faible';
    else if (score < 75) label = 'Moyen';
    else if (score < 90) label = 'Fort';
    else label = 'Excellent';

    return { score, entropy, label, feedback };
  }

  // --- Authentificateur 2FA / TOTP (RFC 6238 & RFC 4226) ---

  /**
   * Décode une chaîne Base32 standard (RFC 4648) en tableau d'octets.
   * Gère les espaces, tirets et URLs au format `otpauth://totp/...`.
   */
  public static base32ToBuffer(base32: string): Uint8Array {
    let clean = base32.trim();
    if (clean.startsWith('otpauth://')) {
      try {
        const url = new URL(clean);
        clean = url.searchParams.get('secret') || clean;
      } catch {
        const match = clean.match(/secret=([A-Za-z2-7]+)/i);
        if (match) clean = match[1];
      }
    }
    clean = clean.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < clean.length; i++) {
      const idx = alphabet.indexOf(clean[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(output);
  }

  /**
   * Calcule le code dynamique 2FA (TOTP à 6 chiffres) pour l'intervalle de temps actuel (30s)
   * selon la spécification RFC 6238 avec HMAC-SHA-1 via Web Crypto API.
   */
  public static async generateTOTP(
    secretOrUri: string,
    timestampSeconds: number = Math.floor(Date.now() / 1000)
  ): Promise<{ code: string; secondsRemaining: number }> {
    const keyBytes = this.base32ToBuffer(secretOrUri);
    if (keyBytes.length === 0) {
      throw new Error('Clé secrète 2FA Base32 invalide.');
    }

    const epoch = Math.floor(timestampSeconds / 30);
    const secondsRemaining = 30 - (timestampSeconds % 30);

    // Compteur sur 8 octets big-endian
    const counterBuf = new ArrayBuffer(8);
    const view = new DataView(counterBuf);
    view.setUint32(0, Math.floor(epoch / 0x100000000), false);
    view.setUint32(4, epoch & 0xffffffff, false);

    const hmacKey = await this.subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await this.subtle.sign('HMAC', hmacKey, counterBuf);
    const digest = new Uint8Array(signature);

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    return { code: otp, secondsRemaining };
  }

  // --- Générateur de Phrases Secrètes (Passphrase / Diceware) ---

  private static readonly WORDLIST: string[] = [
    'aurore', 'balise', 'cascade', 'diamant', 'etoile', 'faucon', 'galaxie', 'horizon',
    'ilot', 'jardin', 'lagon', 'montagne', 'nebuleuse', 'ocean', 'palais', 'quartz',
    'riviere', 'soleil', 'tigre', 'univers', 'volcan', 'zenith', 'boussole', 'cristal',
    'dauphin', 'espace', 'flamme', 'glacier', 'harmonie', 'indigo', 'jaspe', 'karate',
    'lumiere', 'mirage', 'navire', 'oasis', 'planete', 'quasar', 'refuge', 'silence',
    'totem', 'utopie', 'vortex', 'abysse', 'boreal', 'comete', 'dune', 'eclair',
    'foudre', 'geyser', 'hibou', 'iris', 'jonquille', 'koala', 'lune', 'meteor',
    'nomade', 'orchidee', 'pyramide', 'quitus', 'racine', 'saphir', 'toundra', 'uranus',
    'voyage', 'whisky', 'xylophone', 'yeti', 'zebre', 'argent', 'bouclier', 'citadelle',
    'donjon', 'epee', 'forteresse', 'garde', 'heraut', 'insigne', 'javelot', 'katana',
    'lance', 'muraille', 'noble', 'oriflamme', 'paladin', 'quarantaine', 'rempart',
    'sentinelle', 'trident', 'vaillant', 'archer', 'brave', 'courage', 'destrier',
    'ecuyer', 'fleche', 'glaive', 'heaume', 'interdit', 'justicier', 'krypton', 'legende',
    'mage', 'nectar', 'orque', 'protecteur', 'quete', 'royaume', 'secret', 'templier',
    'ultime', 'vigilance', 'warlock', 'xenon', 'bataillon', 'bastion', 'sentier'
  ];

  /**
   * Génère une phrase secrète mnémotechnique à haute entropie (recommandation NIST SP 800-63B).
   */
  public static generatePassphrase(options: PassphraseOptions): string {
    const count = Math.max(3, Math.min(8, options.wordCount));
    const words: string[] = [];
    const randomBytes = this.getRandomBytes(count);

    for (let i = 0; i < count; i++) {
      let word = this.WORDLIST[randomBytes[i] % this.WORDLIST.length];
      if (options.capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      words.push(word);
    }

    let result = words.join(options.separator);
    if (options.includeNumber) {
      const numBytes = this.getRandomBytes(1);
      const randomNum = 10 + (numBytes[0] % 90); // 10 to 99
      result += `${options.separator}${randomNum}`;
    }

    return result;
  }

  // --- Contrôle de Fuite de Mots de Passe (k-Anonymity) ---

  /**
   * Vérifie si un mot de passe a été exposé dans une violation de données publique connue,
   * en utilisant le modèle k-Anonymity (API HaveIBeenPwned).
   * ZÉRO-KNOWLEDGE : Seuls les 5 premiers caractères du hash SHA-1 sont transmis au réseau.
   */
  public static async checkPasswordBreach(password: string): Promise<{ breached: boolean; count: number }> {
    if (!password) return { breached: false, count: 0 };
    try {
      const enc = new TextEncoder();
      const digest = await this.subtle.digest('SHA-1', enc.encode(password));
      const sha1Hex = this.bufferToHex(digest).toUpperCase();
      const prefix = sha1Hex.substring(0, 5);
      const suffix = sha1Hex.substring(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
      });

      if (!response.ok) {
        return { breached: false, count: 0 };
      }

      const text = await response.text();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const [hashSuffix, countStr] = line.trim().split(':');
        if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
          const count = parseInt(countStr || '1', 10);
          return { breached: true, count };
        }
      }
      return { breached: false, count: 0 };
    } catch {
      // Échec silencieux si pas d'accès Internet ou API indisponible
      return { breached: false, count: 0 };
    }
  }
}
