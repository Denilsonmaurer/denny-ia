import React from 'react';
import { User } from 'firebase/auth';
import { db, doc, updateDoc } from '../firebase';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    dennyCustomName: string;
    setDennyCustomName: (val: string) => void;
    userPreferredName: string;
    setUserPreferredName: (val: string) => void;
    theme: string;
    setTheme: (val: string) => void;
    tempColor: string;
    setTempColor: (val: string) => void;
    setCustomThemeColor: (val: string) => void;
    onApplyTheme?: (theme: string | undefined, customColor: string | undefined) => void;
    voiceName: string;
    setVoiceName: (val: string) => void;
    onOpenArchived: () => void;
    onOpenFocoFlow: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    user,
    dennyCustomName,
    setDennyCustomName,
    userPreferredName,
    setUserPreferredName,
    theme,
    setTheme,
    tempColor,
    setTempColor,
    setCustomThemeColor,
    onApplyTheme,
    voiceName,
    setVoiceName,
    onOpenArchived,
    onOpenFocoFlow
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-secondary)] p-8 rounded-2xl w-full max-w-md shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Configurações</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl">&times;</button>
                </div>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Personalization Section */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Personalização de Nomes</label>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Nome do Assistente</label>
                                <input 
                                    type="text" 
                                    value={dennyCustomName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setDennyCustomName(val);
                                        updateDoc(doc(db, 'users', user.uid), { dennyCustomName: val });
                                    }}
                                    placeholder="Ex: Denny"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Como devo te chamar?</label>
                                <input 
                                    type="text" 
                                    value={userPreferredName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setUserPreferredName(val);
                                        updateDoc(doc(db, 'users', user.uid), { userPreferredName: val });
                                    }}
                                    placeholder="Seu nome"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-[var(--text-secondary)]">Tema</label>
                        <select 
                            value={theme} 
                            onChange={e => {
                                const newTheme = e.target.value;
                                setTheme(newTheme);
                                updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
                            }}
                            className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="dark">Escuro</option>
                            <option value="light">Claro</option>
                        </select>
                    </div>
                    
                    {/* Custom Color Picker */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Personalizar Cor do Sistema</label>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">Escolha uma cor para alterar todo o visual do Denny.</p>
                        
                        <div className="flex items-center gap-4">
                            <input 
                                type="color" 
                                value={tempColor}
                                onChange={(e) => {
                                    setTempColor(e.target.value);
                                    if (onApplyTheme) onApplyTheme(theme, e.target.value);
                                }}
                                className="h-12 w-12 cursor-pointer border-none bg-transparent rounded-full overflow-hidden shadow-sm"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-mono text-[var(--text-primary)] mb-1">{tempColor}</div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setCustomThemeColor(tempColor);
                                            if (onApplyTheme) onApplyTheme(theme, tempColor);
                                            updateDoc(doc(db, 'users', user.uid), { customThemeColor: tempColor });
                                        }}
                                        className="px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-xs font-bold hover:opacity-90 transition-opacity"
                                    >
                                        Aplicar Cor
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const defaultBlue = '#00B7FF';
                                            setTempColor(defaultBlue);
                                            setCustomThemeColor(defaultBlue);
                                            if (onApplyTheme) onApplyTheme(theme, defaultBlue);
                                            updateDoc(doc(db, 'users', user.uid), { customThemeColor: defaultBlue });
                                        }}
                                        className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded text-xs hover:text-[var(--text-primary)] transition-colors"
                                    >
                                        Restaurar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-[var(--text-secondary)]">Voz do Sistema</label>
                        <select 
                            value={voiceName}
                            onChange={e => {
                                const v = e.target.value;
                                setVoiceName(v);
                                updateDoc(doc(db, 'users', user.uid), { voiceName: v });
                            }}
                            className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="Kore">Kore (Padrão - Feminina)</option>
                            <option value="Fenrir">Fenrir (Masculina Profunda)</option>
                            <option value="Puck">Puck (Masculina Suave)</option>
                            <option value="Charon">Charon (Masculina Séria)</option>
                            <option value="Aoede">Aoede (Feminina Suave)</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
                        <button 
                            onClick={onOpenFocoFlow}
                            className="w-full py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-text)] rounded-lg transition-colors flex items-center justify-center gap-2 font-bold text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Integração FocoFlow
                        </button>
                        <button 
                            onClick={onOpenArchived}
                            className="w-full py-2 text-[var(--accent-primary)] hover:underline text-sm font-semibold text-left"
                        >
                            Conversas Arquivadas
                        </button>
                        <a href="/#/ajuda-e-suporte" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Ajuda e Suporte</a>
                        <a href="/#/termos-e-condicoes" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Termos e Condições</a>
                        <a href="/#/seguranca" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Segurança</a>
                        <a href="/#/comandos-de-voz" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Guia de Comandos</a>
                    </div>
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--border-color)] transition-colors font-bold">Fechar</button>
            </div>
        </div>
    );
};

export default SettingsModal;
