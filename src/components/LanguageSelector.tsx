"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, type SupportedLanguage } from '@/context/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageOption {
    code: SupportedLanguage;
    label: string;
    flag: string;
    nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
    { code: 'es', label: 'Español', flag: '🇲🇽', nativeName: 'Español' },
    { code: 'en', label: 'English', flag: '🇺🇸', nativeName: 'English' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'zh', label: '中文', flag: '🇨🇳', nativeName: '中文 (简体)' },
];

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative inline-block text-left select-none">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border bg-slate-900/60 hover:bg-slate-800/80 border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(0,242,255,0.1)] active:scale-95"
                title="Cambiar idioma / Switch language"
                aria-expanded={isOpen}
            >
                <span className="text-sm leading-none">{currentLang.flag}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider">{currentLang.code}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_15px_35px_rgba(0,0,0,0.6)] py-1.5 z-[100] animate-in fade-in zoom-in-95 duration-150"
                    role="menu"
                >
                    <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <Globe size={12} className="text-cyan-400" />
                        <span>Idioma / Language</span>
                    </div>

                    <div className="py-1">
                        {LANGUAGES.map((item) => {
                            const isSelected = item.code === language;
                            return (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => {
                                        setLanguage(item.code);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                                        isSelected
                                            ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400 font-bold'
                                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                                    }`}
                                    role="menuitem"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{item.flag}</span>
                                        <div className="flex flex-col items-start leading-tight">
                                            <span>{item.nativeName}</span>
                                            <span className="text-[10px] text-slate-500">{item.label}</span>
                                        </div>
                                    </div>
                                    {isSelected && <Check size={14} className="text-cyan-400" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
