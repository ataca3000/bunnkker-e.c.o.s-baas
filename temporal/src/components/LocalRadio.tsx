"use client";

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, Radio } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function LocalRadio() {
    const { profile } = useAuth();
    const pathname = usePathname();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isReceiving, setIsReceiving] = useState(false);
    const [rxSender, setRxSender] = useState<string>('');
    
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContext = useRef<AudioContext | null>(null);
    const isSpaceDown = useRef(false);

    // Ocultar botón de micrófono fuera del dashboard (/dashboard/*)
    const isDashboardRoute = pathname ? pathname.startsWith('/dashboard') : false;

    // Solo habilitar para staff y dentro del dashboard
    const isStaff = profile?.role && profile.role !== 'client' && isDashboardRoute;

    useEffect(() => {
        if (!isStaff || typeof window === 'undefined') return;

        // Puerto de radio configurable (3002 por defecto)
        const radioPort = process.env.NEXT_PUBLIC_RADIO_PORT || '3002';
        const host = window.location.hostname;
        const newSocket = io(`http://${host}:${radioPort}`, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });
        
        newSocket.on('connect', () => {
            console.log('📻 Radio Conectado');
            newSocket.emit('join_radio', { role: profile?.role, name: profile?.displayName || (profile as any)?.name });
        });

        newSocket.on('radio_rx', async (data: { senderId: string, senderName: string, audio: ArrayBuffer }) => {
            console.log(`📡 Recibiendo transmisión de: ${data.senderName}`);
            setIsReceiving(true);
            setRxSender(data.senderName);
            
            try {
                if (!audioContext.current) {
                    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                
                // Asegurar que el contexto está activo
                if (audioContext.current.state === 'suspended') {
                    await audioContext.current.resume();
                }

                const audioBuffer = await audioContext.current.decodeAudioData(data.audio);
                const source = audioContext.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.current.destination);
                
                // Beep de entrada
                playBeep(800, 0.1);
                
                source.start(0);
                
                source.onended = () => {
                    setIsReceiving(false);
                    // Beep de salida
                    playBeep(400, 0.1);
                };
            } catch (err) {
                console.error("Error reproduciendo radio:", err);
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


    const playBeep = (freq: number, dur: number) => {
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

    const startRecording = async () => {
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

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();
            setIsRecording(false);
            playBeep(300, 0.1);
        }
    };

    if (!isStaff) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] pointer-events-auto">
            {isReceiving && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap animate-pulse shadow-[0_0_15px_rgba(14,165,233,0.5)] flex items-center gap-2">
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
                title="Mantén presionado para hablar (o usa la barra espaciadora)"
            >
                {isRecording ? <Mic size={28} className="animate-pulse" /> : <MicOff size={24} />}
                
                {/* Ondas expansivas al grabar */}
                {isRecording && (
                    <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-ping opacity-75"></div>
                )}
            </button>
            <p className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest mt-2 hidden md:block">
                PTT (Espacio)
            </p>
        </div>
    );
}
