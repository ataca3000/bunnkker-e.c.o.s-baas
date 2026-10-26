'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

export default function AmbientMusic() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) {
            // Carga diferida estricta: solo se descarga el audio si el usuario hace clic expresamente
            const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3');
            audio.preload = 'none';
            audio.loop = true;
            audio.volume = 0.15; // Volumen suave, ambiental
            audioRef.current = audio;
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                setIsPlaying(false);
            });
        }
    };

    return (
        <button 
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar música ambiental" : "Reproducir música ambiental"}
            className="fixed bottom-6 right-6 z-50 bg-slate-900/80 backdrop-blur-md p-3 rounded-full shadow-xl border border-white/10 text-slate-300 hover:text-sky-400 hover:scale-110 transition-all flex items-center gap-2 group"
            title={isPlaying ? "Pausar música ambiental" : "Reproducir música ambiental"}
        >
            <div className="absolute inset-0 bg-sky-500/10 rounded-full animate-ping opacity-0 group-hover:opacity-100" style={{ animationDuration: '3s' }}></div>
            {isPlaying ? (
                <>
                    <Volume2 size={20} className="text-sky-400" />
                    <Music size={14} className="text-sky-400 animate-pulse" />
                </>
            ) : (
                <VolumeX size={20} />
            )}
        </button>
    );
}

