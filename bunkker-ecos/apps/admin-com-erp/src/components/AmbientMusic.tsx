'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

export default function AmbientMusic() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [interacted, setInteracted] = useState(false);

    useEffect(() => {
        // Un track lofi sin copyright, relajante y que inspira confianza
        const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3');
        audio.loop = true;
        audio.volume = 0.15; // Volumen suave, ambiental
        audioRef.current = audio;

        const handleInteraction = () => {
            if (!interacted && audioRef.current) {
                setInteracted(true);
                audioRef.current.play().then(() => {
                    setIsPlaying(true);
                }).catch(() => {
                    // Ignorar errores de autoplay
                });
            }
        };

        // Escuchar la primera interacción para iniciar la música (políticas de navegadores)
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('scroll', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    const toggleMute = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    if (!interacted) return null;

    return (
        <button 
            onClick={toggleMute}
            className="fixed bottom-6 right-6 z-50 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-xl border border-white/40 text-slate-600 hover:text-sky-500 hover:scale-110 transition-all flex items-center gap-2 group"
            title={isPlaying ? "Pausar música ambiental" : "Reproducir música ambiental"}
        >
            <div className="absolute inset-0 bg-sky-500/10 rounded-full animate-ping opacity-0 group-hover:opacity-100" style={{ animationDuration: '3s' }}></div>
            {isPlaying ? (
                <>
                    <Volume2 size={20} className="text-sky-500" />
                    <Music size={14} className="text-sky-500 animate-pulse" />
                </>
            ) : (
                <VolumeX size={20} />
            )}
        </button>
    );
}
