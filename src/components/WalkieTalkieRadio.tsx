"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db, hasRealCredentials } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Radio, Send, Volume2, VolumeX, X, Mic, MicOff, Headphones, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/lib/toast';

export default function WalkieTalkieRadio() {
    const { profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [status, setStatus] = useState<'standby' | 'transmitting' | 'receiving'>('standby');
    const [unread, setUnread] = useState(0);
    const [handsFreeVox, setHandsFreeVox] = useState(false);
    const [hardwareButtonsActive, setHardwareButtonsActive] = useState(true);
    const [isListeningVoice, setIsListeningVoice] = useState(false);
    const processedMsgIds = useRef<Set<string>>(new Set());
    const lastMsgCount = useRef(0);
    const recognitionRef = useRef<any>(null);
    const pressedKeysRef = useRef<Set<string>>(new Set());

    const isStaff = profile?.role && ['superadmin', 'sales', 'inventory', 'billing', 'driver', 'carga_descarga'].includes(profile.role);

    // Audio Synthesis: Generar ruido estático de radio virtual
    const playRadioStatic = (duration = 0.4, frequency = 1200, q = 1.5) => {
        if (typeof window === 'undefined' || isMuted) return;
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            
            const bufferSize = audioCtx.sampleRate * duration;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noiseNode = audioCtx.createBufferSource();
            noiseNode.buffer = buffer;
            
            const filterNode = audioCtx.createBiquadFilter();
            filterNode.type = 'bandpass';
            filterNode.frequency.value = frequency;
            filterNode.Q.value = q;
            
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.15;
            
            noiseNode.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            noiseNode.start();
        } catch (e) {
            console.warn("Audio Context block:", e);
        }
    };

    const speakMessage = (sender: string, text: string) => {
        if (typeof window === 'undefined' || isMuted) return;
        const synth = window.speechSynthesis;
        if (!synth) return;

        synth.cancel();
        playRadioStatic(0.4, 900, 2.0);

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(`${sender} dice: ${text}, cambio.`);
            utterance.lang = 'es-MX';
            utterance.rate = 1.05;
            utterance.pitch = 0.95;

            utterance.onstart = () => setStatus('receiving');
            utterance.onend = () => {
                setStatus('standby');
                playRadioStatic(0.3, 1100, 1.2);
            };
            utterance.onerror = () => setStatus('standby');

            synth.speak(utterance);
        }, 300);
    };

    useEffect(() => {
        if (!hasRealCredentials || !auth?.currentUser) return;

        const qRadio = query(
            collection(db, 'radio_channel'),
            orderBy('timestamp', 'desc'),
            limit(15)
        );

        const unsubscribe = onSnapshot(qRadio, (snap: any) => {
            const list: any[] = [];
            snap.forEach((doc: any) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            
            const cronoList = list.reverse();
            setMessages(cronoList);

            if (lastMsgCount.current === 0) {
                cronoList.forEach(m => processedMsgIds.current.add(m.id));
                lastMsgCount.current = cronoList.length;
                return;
            }

            const latest = cronoList[cronoList.length - 1];
            if (latest && !processedMsgIds.current.has(latest.id)) {
                processedMsgIds.current.add(latest.id);
                
                const isForeign = latest.senderUid !== profile?.uid;
                const msgTime = latest.timestamp?.seconds ? latest.timestamp.seconds * 1000 : Date.now();
                const isRecent = Date.now() - msgTime < 15000;

                if (isForeign && isRecent) {
                    speakMessage(latest.senderName, latest.text);
                    if (!isOpen) {
                        setUnread(prev => prev + 1);
                    }
                }
            }
            lastMsgCount.current = cronoList.length;
        }, (err: any) => {
            console.warn('[WalkieTalkieRadio] Canal en modo local:', err?.message);
        });

        return () => unsubscribe();
    }, [db, profile, isMuted, isOpen]);

    const transmitMessage = useCallback(async (textToSend: string) => {
        if (!textToSend.trim()) return;
        setStatus('transmitting');
        playRadioStatic(0.3, 1200, 1.0);

        try {
            await addDoc(collection(db, 'radio_channel'), {
                senderName: profile?.displayName || 'Operativo',
                senderRole: profile?.role || 'staff',
                senderUid: profile?.uid || 'anonymous',
                text: textToSend.trim(),
                timestamp: serverTimestamp()
            });

            setTimeout(() => {
                playRadioStatic(0.25, 1000, 1.5);
                setStatus('standby');
            }, 600);
        } catch (err) {
            console.error("Fallo transmisión de radio:", err);
            setStatus('standby');
        }
    }, [db, profile]);

    const handleTransmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        const msg = inputText.trim();
        setInputText('');
        await transmitMessage(msg);
    };

    // ── MODO MANOS LIBRES (VOX): RECONOCIMIENTO CONTINUO DE VOZ ──
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (handsFreeVox) {
            try {
                const recognizer = new SpeechRecognition();
                recognizer.lang = 'es-MX';
                recognizer.continuous = true;
                recognizer.interimResults = false;

                recognizer.onstart = () => setIsListeningVoice(true);
                recognizer.onend = () => {
                    setIsListeningVoice(false);
                    if (handsFreeVox) {
                        try { recognizer.start(); } catch {}
                    }
                };
                recognizer.onresult = (event: any) => {
                    const lastIndex = event.results.length - 1;
                    const transcript = event.results[lastIndex][0].transcript;
                    if (transcript && transcript.trim().length > 1) {
                        transmitMessage(transcript.trim());
                    }
                };
                recognizer.onerror = () => setIsListeningVoice(false);

                recognizer.start();
                recognitionRef.current = recognizer;
                toast.success('🎙️ Manos Libres (VOX) activado. Habla para transmitir.');
            } catch (e) {
                console.warn("Speech recognition error:", e);
            }
        } else {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
                recognitionRef.current = null;
                setIsListeningVoice(false);
            }
        }

        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
        };
    }, [handsFreeVox, transmitMessage]);

    // ── MODO BOTONES FÍSICOS DE HARDWARE (VOLUMEN / AURICULARES / TECLADO) ──
    useEffect(() => {
        if (typeof window === 'undefined' || !hardwareButtonsActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

            pressedKeysRef.current.add(e.code || e.key);

            const hasVolUp = pressedKeysRef.current.has('AudioVolumeUp') || pressedKeysRef.current.has('VolumeUp');
            const hasVolDown = pressedKeysRef.current.has('AudioVolumeDown') || pressedKeysRef.current.has('VolumeDown');

            // Presionar ambos botones de volumen o la tecla T
            if ((hasVolUp && hasVolDown) || e.code === 'KeyT') {
                e.preventDefault();
                setHandsFreeVox(prev => {
                    const next = !prev;
                    toast.info(next ? '🎙️ PTT rápido activado por botones físicos' : 'PTT desactivado');
                    return next;
                });
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            pressedKeysRef.current.delete(e.code || e.key);
        };

        // MediaSession para botones físicos de audífonos / manos libres Bluetooth
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('play', () => {
                    setHandsFreeVox(prev => !prev);
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    setHandsFreeVox(false);
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    setHandsFreeVox(prev => !prev);
                });
            } catch {}
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [hardwareButtonsActive]);

    const handleToggleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setUnread(0);
    };

    if (!isStaff) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[2500] font-sans">
            <AnimatePresence>
                {isOpen ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        className="bg-[#1e1e1e] border-[12px] border-[#0a0a0a] rounded-[40px] w-[320px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative p-5 flex flex-col items-center"
                        style={{ backgroundImage: 'radial-gradient(circle at top, #2a2a2a 0%, #111 100%)' }}
                    >
                        <div className="absolute -top-12 left-10 w-4 h-12 bg-slate-900 rounded-t-lg flex items-center justify-center">
                            <div className="w-1.5 h-10 bg-slate-700 rounded-t"></div>
                        </div>
                        <div className="absolute -top-4 right-12 w-6 h-4 bg-slate-950 rounded-t border-b border-slate-800"></div>

                        <div className="w-full flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${status === 'transmitting' ? 'bg-red-600 animate-ping' : status === 'receiving' ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'} border border-slate-900`}></span>
                                {status === 'transmitting' ? 'TX' : status === 'receiving' ? 'RX' : 'STBY'}
                            </span>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsMuted(!isMuted)} 
                                    className="p-1 rounded-md text-slate-400 hover:text-white transition-colors"
                                    title={isMuted ? "Activar audio" : "Silenciar"}
                                >
                                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>
                                <button 
                                    onClick={handleToggleOpen} 
                                    className="p-1 rounded-md text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Pantalla LCD Verde Militar de Radio */}
                        <div className="w-full bg-[#9ccc65] border-2 border-slate-950 rounded-xl p-3 text-slate-900 font-mono text-center shadow-inner mb-3 relative overflow-hidden select-none">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none"></div>
                            <div className="text-[10px] font-black uppercase opacity-60 flex justify-between">
                                <span>CH-01</span>
                                <span className="font-mono">{handsFreeVox ? '🎙️ VOX ON' : '146.520 MHz'}</span>
                            </div>
                            <div className="text-base font-black my-1 tracking-wider">
                                {status === 'transmitting' ? 'TRANSMITIENDO...' : status === 'receiving' ? 'RX: ENTRANTE' : handsFreeVox ? 'VOX: ESCUCHANDO...' : 'RADIO GRUPAL'}
                            </div>
                            <div className="text-[9px] opacity-75 truncate">
                                {profile?.displayName || 'Operativo'} · {profile?.role}
                            </div>
                        </div>

                        {/* ── BARRA DE MODOS: MANOS LIBRES (VOX) & BOTONES FÍSICOS (VOL +/-) ── */}
                        <div className="w-full flex items-center justify-between gap-1.5 mb-3">
                            <button
                                type="button"
                                onClick={() => setHandsFreeVox(!handsFreeVox)}
                                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border ${
                                    handsFreeVox 
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md animate-pulse' 
                                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                                title="Activar transmisión por voz sin tocar la pantalla"
                            >
                                {handsFreeVox ? <Mic size={12} className="text-rose-400" /> : <MicOff size={12} />}
                                <span>{handsFreeVox ? 'VOX ACTIVO' : 'MANOS LIBRES'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setHardwareButtonsActive(!hardwareButtonsActive);
                                    toast.info(hardwareButtonsActive ? 'Botones físicos desactivados' : 'Presiona Vol +/- para transmitir');
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border ${
                                    hardwareButtonsActive 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md' 
                                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                                title="Presiona ambos botones de volumen o auricular para transmitir"
                            >
                                <Headphones size={12} className={hardwareButtonsActive ? 'text-emerald-400' : ''} />
                                <span>BOTONES VOL +/-</span>
                            </button>
                        </div>

                        <div className="w-full h-10 bg-slate-900/40 rounded-2xl p-2 flex flex-col gap-1 mb-3 border border-slate-700/30 overflow-hidden">
                            {[1, 2].map(row => (
                                <div key={row} className="flex justify-between opacity-30 gap-1.5">
                                    {Array.from({ length: 14 }).map((_, i) => (
                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="w-full flex-1 bg-slate-950 rounded-2xl p-3 h-[170px] overflow-y-auto mb-3 scrollbar-thin border border-slate-700/50 flex flex-col gap-2">
                            {messages.map((msg) => (
                                <div key={msg.id} className="text-[10px] text-slate-300 border-b border-slate-900/50 pb-1.5 last:border-0 leading-tight">
                                    <span className="font-black text-rose-400 uppercase">[{msg.senderRole}] {msg.senderName}:</span>{' '}
                                    <span className="font-medium">{msg.text}</span>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-slate-600 text-center py-10 text-[10px] font-bold uppercase tracking-widest">
                                    Canal de radio vacío
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleTransmit} className="w-full flex flex-col gap-2.5 mt-1">
                            <input 
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Escribe o habla con VOX..."
                                className="w-full px-3 py-2 bg-[#0a0a0a] border-2 border-[#333] rounded-md text-xs font-semibold text-emerald-400 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600 font-mono shadow-inner"
                            />
                            
                            <button 
                                type="submit"
                                className="w-full bg-gradient-to-b from-[#ffcc00] to-[#b38f00] text-black font-black uppercase tracking-widest py-3.5 rounded-xl shadow-[0_6px_0_#806600,0_12px_18px_rgba(0,0,0,0.6)] active:shadow-[0_2px_0_#806600,0_4px_8px_rgba(0,0,0,0.6)] active:translate-y-1.5 transition-all flex items-center justify-center gap-2"
                                title="Transmitir (PTT)"
                            >
                                <Send size={18} /> PTT (ENVIAR)
                            </button>
                        </form>

                        <div className="mt-4 w-full p-2.5 bg-black/40 border border-slate-700/30 rounded-xl flex items-start gap-2">
                            <span className="text-[13px]">📡</span>
                            <p className="text-[9px] text-slate-400 leading-tight">
                                <strong className="text-white">Tip Operativo:</strong> Presiona ambos botones de volumen del celular o el botón de tus audífonos para hablar sin mirar la pantalla.
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        layoutId="walkie-radio"
                        onClick={handleToggleOpen}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-full border-3 border-slate-950 shadow-2xl flex items-center justify-center relative active:scale-95"
                    >
                        <Radio size={24} className="text-rose-500" />
                        
                        {unread > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black rounded-full h-5 w-5 flex items-center justify-center border-2 border-slate-800 animate-bounce">
                                {unread}
                            </span>
                        )}
                        
                        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-800"></span>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
