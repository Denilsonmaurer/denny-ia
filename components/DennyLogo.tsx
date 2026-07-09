import React from 'react';
import { Bot } from 'lucide-react';

interface DennyLogoProps {
  className?: string;
}

const DennyLogo: React.FC<DennyLogoProps> = ({ className = "" }) => (
  <div className={`flex items-center space-x-2 ${className}`}>
    <div className="bg-[var(--accent-primary)] p-1.5 rounded-lg shadow-lg border-2 border-[var(--accent-primary)]">
      <Bot className="w-6 h-6 text-[var(--accent-primary-text)]" />
    </div>
    <div className="font-extrabold text-xl">
      <span className="text-[var(--text-primary)]">Denny</span><span className="text-[var(--accent-primary)]">IA</span>
    </div>
  </div>
);

export default DennyLogo;
