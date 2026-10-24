"use client";

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, Radio } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/context/LanguageContext';

export default function LocalRadio() {
    const { profile } = useAuth();
    const { t } = useTranslation();
    const pathname = usePathname();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isReceiving, setIsReceiving] = useState(false);
    const [rxSender, setRxSender] = useState<string>('');
    const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'offline'>('connecting');
    
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContext = useRef<AudioContext | null>(null);
    const isSpaceDown = useRef(false);

    // Ocultar botón de micrófono fuera del dashboard (/dashboard/*)
    const isDashboardRoute = pathname ? pathname.startsWith('/dashboard') : false;

    // Solo habilitar para staff y dentro del dashboard (ocultar en POS para no tapar artículos)
    const isStaff = profile?.role && profile.role !== 'client' && isDashboardRoute && pathname !== '/dashboard/sales';

    useEffect(() => {
        if (!isStaff || typeof window === 'undefined') return;

        // En producción la app vive en Vercel: la radio debe apuntar al PC
        // servidor dentro de la LAN, no al hostname de Vercel.
        const configuredUrl = process.env.NEXT_PUBLIC_RADIO_URL?.trim();
        const radioPort = process.env.NEXT_PUBLIC_RADIO_PORT || '3002';
        const host = window.location.hostname;
        const radioUrl = configuredUrl || `http://${host}:${radioPort}`;
        const newSocket = io(radioUrl, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });
        
        newSocket.on('connect', () => {
            console.log('[v0] Radio LAN conectada:', radioUrl);
            setConnectionState('connected');
            newSocket.emit('join_radio', { 
                role: profile?.role, 
                uid: profile?.uid,
                signature: (profile as any)?.signature,
                name: profile?.displayName || (profile as any)?.name 
            });
        });
        newSocket.on('connect_error', (error) => {
            console.log('[v0] Radio LAN no disponible:', error.message);
            setConnectionState('offline');
        });
        newSocket.on('disconnect', () => setConnectionState('offline'));

        newSocket.on('radio_rx', async (data: { senderId: string, senderName: string, audio: ArrayBuffer | Blob | any }) => {
            console.log(`📡 Recibiendo transmisión de: ${data.senderName}`);
            setIsReceiving(true);
            setRxSender(data.senderName);
            
            try {
                // Beep de entrada
                playBeep(800, 0.1);

                // Método 1 (El más compatible en navegadores modernos/Electron): HTMLAudio con Blob URL
                const blob = data.audio instanceof Blob 
                    ? data.audio 
                    : new Blob([data.audio], { type: 'audio/webm' });
                
                const blobUrl = URL.createObjectURL(blob);
                const audioPlayer = new window.Audio(blobUrl);
                
                audioPlayer.onended = () => {
                    setIsReceiving(false);
                    URL.revokeObjectURL(blobUrl);
                    playBeep(400, 0.1);
                };

                audioPlayer.onerror = async () => {
                    // Fallback a Web Audio API si HTMLAudio falla
                    try {
                        if (!audioContext.current) {
                            audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                        }
                        if (audioContext.current.state === 'suspended') {
                            await audioContext.current.resume();
                        }
                        const arrayBuf = data.audio instanceof ArrayBuffer ? data.audio.slice(0) : await blob.arrayBuffer();
                        const audioBuffer = await audioContext.current.decodeAudioData(arrayBuf);
                        const source = audioContext.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(audioContext.current.destination);
                        source.start(0);
                        source.onended = () => {
                            setIsReceiving(false);
                            playBeep(400, 0.1);
                        };
                    } catch (fallbackErr) {
                        console.error("Error reproduciendo radio en fallback:", fallbackErr);
                        setIsReceiving(false);
                    }
                };

                await audioPlayer.play();
            } catch (err) {
                console.error("Error iniciando reproducción de radio:", err);
                setIsReceiving(false);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isStaff, profile]);

    // Keyboard PTT (Barra Espaciadora)
    useEffect(() => {
        if (!isStaff) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && e.target === document.body) {
                e.preventDefault(); // Evitar scroll
                if (!isSpaceDown.current) {
                    isSpaceDown.current = true;
                    startRecording();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                isSpaceDown.current = false;
                stopRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isStaff, socket]);


    function playBeep(freq: number, dur: number) {
        try {
            if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const ctx = audioContext.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + dur);
        } catch (e) {}
    };

    async function startRecording() {
        if (!socket) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                socket.emit('radio_tx', { 
                    name: profile?.displayName || (profile as any)?.name, 
                    audio: arrayBuffer 
                });

                // Liberar micrófono
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            playBeep(600, 0.1);
            
            if (navigator.vibrate) navigator.vibrate(50);
        } catch (err: any) {
            console.error("No se pudo acceder al micrófono:", err);
            if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
                toast.error('Haz clic en el candado 🔒 en la barra de direcciones, dale "Permitir" al Micrófono y vuelve a intentarlo.', '🎤 Permiso Denegado');
            } else if (err.name === 'NotFoundError') {
                toast.error('No se detectó ningún micrófono conectado.', '🔌 Sin Equipo');
            } else {
                toast.error('Verifica los permisos de tu navegador o sistema.', '🎤 Acceso Bloqueado');
            }
        }
    };

    function stopRecording() {
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();
            setIsRecording(false);
            playBeep(300, 0.1);
        }
    };

    if (!isStaff) return null;

    return (
        <div className="fixed bottom-20 md:bottom-20 left-4 md:left-6 z-[9000] pointer-events-auto flex flex-col items-start">
            {isReceiving && (
                <div className="absolute -top-12 left-0 bg-sky-500 text-white text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap animate-pulse shadow-[0_0_15px_rgba(14,165,233,0.5)] flex items-center gap-2">
                    <Radio size={14} className="animate-spin-slow" />
                    {rxSender}
                </div>
            )}
            
            <button
                onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
                onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
                onPointerLeave={stopRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl touch-none select-none backdrop-blur-md ${
                    isRecording 
                        ? 'bg-red-500/90 text-white scale-110 shadow-[0_0_30px_rgba(239,68,68,0.8)] border border-red-400' 
                        : isReceiving
                        ? 'bg-sky-500/90 text-white scale-105 shadow-[0_0_20px_rgba(14,165,233,0.6)] border-2 border-white'
                        : 'bg-slate-900/60 text-cyan-400 hover:bg-slate-800/80 hover:text-white border border-cyan-500/40 shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                }`}
                title={t('radio.hold_to_talk', 'Mantén presionado para hablar (o usa la barra espaciadora)')}
            >
                {isRecording ? <Mic size={28} className="animate-pulse" /> : <MicOff size={24} />}
                
                {/* Ondas expansivas al grabar */}
                {isRecording && (
                    <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-ping opacity-75"></div>
                )}
            </button>
            <p className="text-[9px] text-left text-slate-400 font-bold uppercase tracking-wider mt-1.5 max-w-[170px] leading-tight hidden md:block">
                {connectionState === 'connected' ? t('radio.lan_ptt', 'Radio LAN · PTT (Espacio)') : connectionState === 'connecting' ? t('radio.connecting', 'Conectando radio local…') : t('radio.offline', 'Radio offline · inicia radio-server')}
            </p>
        </div>
    );
}

