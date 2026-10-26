"use client";

import React, { useEffect, useRef } from 'react';

/**
 * ─── SISTEMA VISUAL POR CAPAS BUNKKER E.C.O.S. ───
 * Capa 1: Fondo base con Logotipo Hero BUNKKER (Escudo de Titanio y Rayo)
 * Capa 2: Partículas flotantes cinéticas en suspensión
 * Capa 3: Domo de red cibernética con pulsos electromagnéticos azules
 * Capa 4: Contenedores translúcidos negros y tipografía azul/cian (en el contenido)
 */
export default function BunkkerLayeredBackground() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // ── Capa 2: Motor de Partículas Ligeras (requestAnimationFrame) ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        // Partículas ultra-ligeras (sin shadowBlur para evitar consumo de CPU)
        const particleCount = 20;
        const particles: Array<{
            x: number;
            y: number;
            radius: number;
            speedX: number;
            speedY: number;
            alpha: number;
            alphaDelta: number;
            color: string;
        }> = [];

        const colors = [
            'rgba(56, 189, 248, ', // sky-400
            'rgba(14, 165, 233, ', // cyan-500
            'rgba(224, 242, 254, '  // sky-100
        ];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.5 + 0.8,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: -Math.random() * 0.4 - 0.1,
                alpha: Math.random() * 0.5 + 0.2,
                alphaDelta: (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }

        let isVisible = true;
        let lastTime = 0;
        const fpsInterval = 1000 / 30; // Limitar a 30 FPS para máximo rendimiento de GPU/CPU

        const handleVisibilityChange = () => {
            isVisible = !document.hidden;
            if (isVisible) {
                lastTime = performance.now();
                animationFrameId = requestAnimationFrame(render);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const render = (currentTime: number = 0) => {
            if (!isVisible) return;
            animationFrameId = requestAnimationFrame(render);

            const elapsed = currentTime - lastTime;
            if (elapsed < fpsInterval) return;
            lastTime = currentTime - (elapsed % fpsInterval);

            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.speedX;
                p.y += p.speedY;
                p.alpha += p.alphaDelta;

                if (p.alpha <= 0.1 || p.alpha >= 0.7) {
                    p.alphaDelta = -p.alphaDelta;
                }

                if (p.y < -10) p.y = height + 10;
                if (p.x < -10) p.x = width + 10;
                if (p.x > width + 10) p.x = -10;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `${p.color}${Math.max(0.1, Math.min(0.7, p.alpha))})`;
                ctx.fill();
            }
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#050811]">
            {/* ── Capa 1: Fondo Base con Logotipo Hero BUNKKER (Escudo de Energía) ── */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.22] mix-blend-screen scale-105 transition-opacity duration-1000"
                style={{
                    backgroundImage: 'url(/bunkker-logo-hero.png)',
                    filter: 'contrast(120%) brightness(95%)',
                }}
            />

            {/* Gradiente radial profundo para centrar foco */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.14),transparent_65%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(2,132,199,0.18),transparent_70%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050811]/70 via-transparent to-[#050811]/90" />

            {/* ── Capa 2: Partículas Flotantes Cuánticas ── */}
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full opacity-70"
            />

            {/* ── Capa 3: Domo de Red Cibernética en Pulsos Tenues Azules ── */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <svg 
                    className="w-[1200px] h-[900px] max-w-full max-h-full animate-pulse-slow" 
                    viewBox="0 0 1000 800" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient id="domeGlow" cx="50%" cy="40%" r="50%">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
                        </radialGradient>
                        <linearGradient id="gridBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* Domo de energía elíptico superior */}
                    <ellipse cx="500" cy="380" rx="460" ry="280" stroke="url(#gridBeam)" strokeWidth="1.5" strokeDasharray="8 8" opacity="0.6" />
                    <ellipse cx="500" cy="380" rx="380" ry="220" stroke="url(#gridBeam)" strokeWidth="1.2" opacity="0.5" />
                    <ellipse cx="500" cy="380" rx="300" ry="160" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="6 6" opacity="0.4" />
                    <ellipse cx="500" cy="380" rx="200" ry="100" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
                    <ellipse cx="500" cy="380" rx="100" ry="50" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.7" fill="url(#domeGlow)" />

                    {/* Líneas meridianas del domo electromagnético */}
                    <path d="M 40 380 Q 500 100 960 380" stroke="url(#gridBeam)" strokeWidth="1.2" />
                    <path d="M 120 380 Q 500 160 880 380" stroke="url(#gridBeam)" strokeWidth="1" />
                    <path d="M 200 380 Q 500 220 800 380" stroke="url(#gridBeam)" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 500 100 L 500 660" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="6 6" opacity="0.4" />
                    <path d="M 320 180 L 680 580" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.25" />
                    <path d="M 680 180 L 320 580" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.25" />

                    {/* Nodos de red estelares pulsantes */}
                    {[
                        [500, 100], [400, 160], [600, 160],
                        [300, 240], [700, 240], [200, 320], [800, 320],
                        [140, 380], [860, 380], [500, 280], [500, 480],
                        [380, 420], [620, 420]
                    ].map(([cx, cy], idx) => (
                        <g key={idx}>
                            <circle cx={cx} cy={cy} r="4" fill="#38bdf8" opacity="0.85" />
                            <circle cx={cx} cy={cy} r="10" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3" />
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
}
