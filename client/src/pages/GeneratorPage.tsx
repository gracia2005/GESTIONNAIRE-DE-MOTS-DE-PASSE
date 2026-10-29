import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Copy,
  RefreshCw,
  Check,
  Sliders,
  History,
  Info,
  KeyRound,
  FileText,
} from 'lucide-react';
import { CryptoEngine, PasswordGeneratorOptions, PassphraseOptions } from '../crypto/cryptoEngine.js';
import { useToast } from '../components/Toast.js';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter.js';

export const GeneratorPage: React.FC = () => {
  const { showToast } = useToast();

  const [generatorMode, setGeneratorMode] = useState<'password' | 'passphrase'>('password');

  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    excludeAmbiguous: true,
  });

  const [passphraseOptions, setPassphraseOptions] = useState<PassphraseOptions>({
    wordCount: 5,
    separator: '-',
    capitalize: true,
    includeNumber: true,
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const handleGenerate = () => {
    let result = '';
    if (generatorMode === 'password') {
      result = CryptoEngine.generatePassword(options);
    } else {
      result = CryptoEngine.generatePassphrase(passphraseOptions);
    }
    setGeneratedPassword(result);
    setHistory(prev => [result, ...prev.filter(p => p !== result)].slice(0, 5));
  };

  useEffect(() => {
    handleGenerate();
  }, [options, passphraseOptions, generatorMode]);

  const handleCopy = (textToCopy?: string) => {
    const val = textToCopy || generatedPassword;
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopied(true);
    showToast('Secret copié dans le presse-papiers !', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
          <Wand2 className="w-6 h-6 text-emerald-500" />
          <span>Générateur de mots de passe cryptographiquement sûr</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Génération aléatoire conforme aux normes NIST via la Web Crypto API (CSPRNG window.crypto.getRandomValues).
        </p>
      </div>

      {/* Main Generator Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-6">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 max-w-md">
          <button
            type="button"
            onClick={() => setGeneratorMode('password')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              generatorMode === 'password'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Mot de passe aléatoire</span>
          </button>
          <button
            type="button"
            onClick={() => setGeneratorMode('passphrase')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              generatorMode === 'passphrase'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Phrase secrète (NIST)</span>
          </button>
        </div>

        {/* Output Display */}
        <div className="relative">
          <div className="w-full min-h-[64px] px-4 py-3 bg-slate-50 dark:bg-slate-850 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-slate-800 dark:text-slate-100 font-mono text-base sm:text-lg tracking-wider break-all select-all">
            <span>{generatedPassword}</span>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <button
                onClick={handleGenerate}
                title="Générer à nouveau"
                className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleCopy()}
                title="Copier"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>
          <PasswordStrengthMeter password={generatedPassword} />
        </div>

        {/* Customization Options */}
        {generatorMode === 'password' ? (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
            {/* Length Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Longueur du mot de passe</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {options.length} caractères
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={options.length}
                onChange={e => setOptions({ ...options, length: parseInt(e.target.value, 10) })}
                className="w-full h-2 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>8 (Minimum)</span>
                <span>20 (Recommandé)</span>
                <span>64 (Maximum)</span>
              </div>
            </div>

            {/* Charset Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={options.useUpper}
                  onChange={e => setOptions({ ...options, useUpper: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Majuscules (A-Z)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Ex : ABCDEFGH</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={options.useLower}
                  onChange={e => setOptions({ ...options, useLower: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Minuscules (a-z)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Ex : abcdefgh</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={options.useNumbers}
                  onChange={e => setOptions({ ...options, useNumbers: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Chiffres (0-9)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Ex : 0123456789</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={options.useSymbols}
                  onChange={e => setOptions({ ...options, useSymbols: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Caractères spéciaux
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Ex : !@#$%^&*()</span>
                </div>
              </label>
            </div>

            {/* Exclude Ambiguous */}
            <label className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={options.excludeAmbiguous}
                onChange={e => setOptions({ ...options, excludeAmbiguous: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Exclure les caractères ambigus
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Évite les confusions de lecture (par exemple <strong>1</strong>, <strong>l</strong>, <strong>I</strong>, <strong>0</strong>, <strong>O</strong>).
                </span>
              </div>
            </label>
          </div>
        ) : (
          /* Passphrase Options */
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
            {/* Word count slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Nombre de mots</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {passphraseOptions.wordCount} mots
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={8}
                value={passphraseOptions.wordCount}
                onChange={e => setPassphraseOptions({ ...passphraseOptions, wordCount: parseInt(e.target.value, 10) })}
                className="w-full h-2 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>3 mots</span>
                <span>5 mots (Recommandé NIST)</span>
                <span>8 mots (Ultra-sécurisé)</span>
              </div>
            </div>

            {/* Separator selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Séparateur entre les mots
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '-', label: 'Tiret (-)' },
                  { id: '.', label: 'Point (.)' },
                  { id: '_', label: 'Tiret bas (_)' },
                  { id: ' ', label: 'Espace' },
                ].map(sep => (
                  <button
                    key={sep.id}
                    type="button"
                    onClick={() => setPassphraseOptions({ ...passphraseOptions, separator: sep.id })}
                    className={`py-2 px-3 text-xs font-mono rounded-xl border text-center transition-all ${
                      passphraseOptions.separator === sep.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sep.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Passphrase Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={passphraseOptions.capitalize}
                  onChange={e => setPassphraseOptions({ ...passphraseOptions, capitalize: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Majuscule sur chaque mot
                  </span>
                  <span className="text-[10px] text-slate-400">Ex : Aurore-Cristal-...</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={passphraseOptions.includeNumber}
                  onChange={e => setPassphraseOptions({ ...passphraseOptions, includeNumber: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Ajouter un nombre aléatoire
                  </span>
                  <span className="text-[10px] text-slate-400">Ex : ...-48</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Recent Generated History */}
        {history.length > 1 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Historique temporaire (effacé à la fermeture de la session)</span>
            </h4>
            <div className="space-y-1.5">
              {history.slice(1).map((pwd, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="truncate mr-2">{pwd}</span>
                  <button
                    onClick={() => handleCopy(pwd)}
                    className="p-1 rounded-md text-slate-400 hover:text-emerald-500 shrink-0"
                    title="Copier"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Security Info Card */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <p>
          Contrairement aux fonctions génératrices pseudo-aléatoires standard (comme <code>Math.random()</code>), le générateur SecureVault utilise l'entropie matérielle fournie par le système d'exploitation via la Web Crypto API pour garantir une imprévisibilité cryptographique absolue.
        </p>
      </div>
    </div>
  );
};
