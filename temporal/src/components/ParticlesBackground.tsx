"use client";

import React, { useEffect, useRef } from 'react';

export default function ParticlesBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: { x: number, y: number, vx: number, vy: number, size: number, alpha: number }[] = [];
        
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            if (window.innerWidth < 768) return; // Optimizacion: No renderizar en móviles para ahorrar batería/CPU
            const numParticles = Math.floor((window.innerWidth * window.innerHeight) / 15000);
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 1.5 + 0.5,
                    alpha: Math.random() * 0.5 + 0.1
                });
            }
        };

        const draw = () => {
            if (window.innerWidth < 768) {
                // If it becomes mobile size, clear and stop doing work
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw particles
                particles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    
                    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                    
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 242, 255, ${p.alpha})`; // Neon cyan tint
                    ctx.fill();
                });
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 pointer-events-none z-0"
            style={{ opacity: 0.4 }}
        />
    );
}
