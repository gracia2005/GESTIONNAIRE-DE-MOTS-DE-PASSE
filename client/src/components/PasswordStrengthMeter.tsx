import React from 'react';
import { CryptoEngine } from '../crypto/cryptoEngine.js';

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  if (!password) return null;

  const strength = CryptoEngine.evaluatePasswordStrength(password);

  const getColor = () => {
    if (strength.score < 25) return 'bg-red-500';
    if (strength.score < 50) return 'bg-orange-500';
    if (strength.score < 75) return 'bg-amber-400';
    if (strength.score < 90) return 'bg-emerald-500';
    return 'bg-emerald-400';
  };

  const getTextColor = () => {
    if (strength.score < 25) return 'text-red-500 dark:text-red-400';
    if (strength.score < 50) return 'text-orange-500 dark:text-orange-400';
    if (strength.score < 75) return 'text-amber-500 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  return (
    <div className="mt-2 space-y-1.5 text-xs">
      <div className="flex justify-between items-center font-medium">
        <span className="text-slate-500 dark:text-slate-400">Robustesse estimée :</span>
        <span className={`${getTextColor()} font-semibold flex items-center gap-1`}>
          {strength.label} ({strength.entropy} bits d'entropie)
        </span>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${strength.score}%` }}
        />
      </div>

      {strength.feedback.length > 0 && (
        <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc list-inside space-y-0.5 pt-0.5">
          {strength.feedback.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
