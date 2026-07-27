"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface ModuleItem {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    href: string;
    desc: string;
}

interface ModuleSectionProps {
    title: string;
    accentColor: string;
    items: ModuleItem[];
}

export default function ModuleSection({
    title,
    accentColor,
    items,
}: ModuleSectionProps) {
    return (
        <div style={{ marginBottom: '2.5rem' }}>
            {/* Section title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem' }}>
                <div style={{ width: '4px', height: '20px', borderRadius: '4px', backgroundColor: accentColor }} />
                <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>
                    {title}
                </h3>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {items.map((node, i) => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Link href={node.href} style={{ textDecoration: 'none', display: 'block' }}>
                            <div className="glass-module hover-lift" style={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderTop: `3px solid ${node.color}`,
                                padding: '1.2rem',
                                borderRadius: '16px',
                                transition: 'box-shadow 0.2s',
                            }}>
                                <div>
                                    <div style={{ color: node.color, marginBottom: '12px' }}>{node.icon}</div>
                                    <h4 style={{ fontSize: '0.88rem', fontWeight: '900', color: '#fff', margin: '0 0 4px' }}>{node.title}</h4>
                                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>{node.desc}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '1rem', fontSize: '0.72rem', fontWeight: '800', color: node.color, gap: '3px' }}>
                                    ACCEDER <ChevronRight size={14} />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
