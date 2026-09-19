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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delayIndex * 0.06 }}
            className="bg-[#1a1d2d] border border-white/5 shadow-[0_0_15px_rgba(14,165,233,0.05)] hover:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-shadow"
            style={{ borderLeft: `4px solid ${color}`, padding: '1.4rem', borderRadius: '16px' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '800', margin: '0 0 6px', letterSpacing: '0.07em' }}>
                        {label}
                    </p>
                    <h3 style={{ fontSize: '1.9rem', fontWeight: '900', color: color, margin: 0, letterSpacing: '-0.02em' }}>
                        {value}
                    </h3>
                    <TrendBadge
                        value={badge.value}
                        label={badge.label}
                        positive={badge.positive}
                        neutral={badge.neutral}
                    />
                </div>
                <div style={{ background: bg, padding: '10px', borderRadius: '12px', flexShrink: 0 }}>
                    {icon}
                </div>
            </div>
        </motion.div>
    );
}
