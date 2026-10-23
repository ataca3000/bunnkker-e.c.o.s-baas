"use client";

import { motion } from 'framer-motion';
import TrendBadge from './TrendBadge';

interface KPICardProps {
    label: string;
    value: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
    badge: {
        value: string;
        label: string;
        positive?: boolean;
        neutral?: boolean;
    };
    delayIndex: number;
    isSelected?: boolean;
    onClick?: () => void;
}

export default function KPICard({
    label,
    value,
    color,
    bg,
    icon,
    badge,
    delayIndex,
    isSelected = false,
    onClick,
}: KPICardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={onClick ? { scale: 1.02, y: -2 } : undefined}
            whileTap={onClick ? { scale: 0.98 } : undefined}
            transition={{ delay: delayIndex * 0.05 }}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            className={`bunkker-translucent-card p-3.5 rounded-xl transition-all relative overflow-hidden select-none ${
                onClick ? 'cursor-pointer' : ''
            } ${
                isSelected
                    ? 'border-2 shadow-[0_0_25px_rgba(14,165,233,0.35)] ring-1 ring-white/20'
                    : 'border border-cyan-500/20 shadow-[0_6px_20px_rgba(0,0,0,0.5)] hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] opacity-90 hover:opacity-100'
            }`}
            style={{
                borderLeft: `4px solid ${color}`,
                borderColor: isSelected ? color : undefined,
                background: isSelected ? 'rgba(15, 23, 42, 0.85)' : undefined,
            }}
        >
            {isSelected && (
                <div
                    className="absolute top-1.5 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: `${color}25`, color: color, border: `1px solid ${color}60` }}
                >
                    FILTRO ACTIVO
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                    <p style={{ color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', margin: '0 0 3px', letterSpacing: '0.06em' }}>
                        {label}
                    </p>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: color, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        {value}
                    </h3>
                    <TrendBadge
                        value={badge.value}
                        label={badge.label}
                        positive={badge.positive}
                        neutral={badge.neutral}
                    />
                </div>
                <div style={{ background: bg, padding: '7px', borderRadius: '10px', flexShrink: 0 }}>
                    {icon}
                </div>
            </div>
        </motion.div>
    );
}

