"use client";

import { useEffect, useRef } from 'react';

export default function ClickSoundProvider() {
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        const playClickSound = () => {
            try {
                if (!audioCtxRef.current) {
                    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const audioCtx = audioCtxRef.current;
                
                // If suspended (because of browser policy), resume
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                // Synth a soft "click" or "pop" sound
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.type = 'sine';
                
                // Frequency sweep to make it a pop
                oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

                // Quick fade out
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Soft volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.05);
            } catch (e) {
                // Ignore audio errors
            }
        };

        const handleClick = (e: MouseEvent) => {
            // Check if clicked element or parent is a button or anchor
            const target = e.target as HTMLElement;
            const isClickable = target.closest('button') || target.closest('a') || target.closest('.clickable');
            
            if (isClickable) {
                playClickSound();
            }
        };

        document.addEventListener('click', handleClick, true); // Use capture phase to catch before stopPropagation
        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    return null;
}
