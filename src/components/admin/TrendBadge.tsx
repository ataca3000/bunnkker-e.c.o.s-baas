"use client";

import { Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TrendBadgeProps {
    value: string;
    label: string;
    positive?: boolean;
    neutral?: boolean;
}

export default function TrendBadge({
    value,
    label,
    positive,
    neutral,
}: TrendBadgeProps) {
    const bg    = neutral ? '#f1f5f9' : positive ? '#ecfdf5' : '#fef2f2';
    const color = neutral ? '#64748b' : positive ? '#065f46' : '#991b1b';
    const Icon  = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: bg, color, fontSize: '0.68rem', fontWeight: '800', padding: '3px 8px', borderRadius: '20px' }}>
                <Icon size={11} />
                {value}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>{label}</span>
        </div>
    );
}
