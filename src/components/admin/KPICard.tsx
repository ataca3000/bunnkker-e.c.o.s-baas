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
}

export default function KPICard({
    label,
    value,
    color,
    bg,
    icon,
    badge,
    delayIndex,
}: KPICardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delayIndex * 0.05 }}
            className="bunkker-translucent-card border border-cyan-500/20 p-3.5 rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.5)] hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-all"
            style={{ borderLeft: `3px solid ${color}` }}
        >
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

