"use client";

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { CheckCircle, ShieldCheck, Zap, AlertTriangle, ArrowRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SuscripcionPage() {
    const { isPremium } = useAuth();
    const { formatCurrency } = useCart();

    const plans = [
        {
            id: 'basic',
            name: 'Plan Punto de Venta (Local)',
            price: 0,
            features: ['Punto de Venta Local', 'Inventario Básico', 'Reportes Diarios', 'Soporte vía Manual'],
            isCurrent: !isPremium,
            color: '#666',
            icon: <Zap size={24} />
        },
        {
            id: 'pro',
            name: 'Plan ERP Pro (Empresarial)',
            price: 500,
            features: [
                'Facturación SAT 4.0 Automatizada',
                'Sincronización en Nube Real-time',
                'Instalación hasta en 5 PCs',
                'Módulo de Marketing y QR',
                'Auditoría Inmutable de Empleados',
                'Backups Automáticos'
            ],
            isCurrent: isPremium,
            color: '#0ea5e9',
            recommended: true,
            icon: <Star size={24} fill="#FFCB05" color="#FFCB05" />
        }
    ];

    return (
        <div style={{ padding: '3rem', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#F7F7F7', minHeight: '100vh' }}>
            <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '950', color: '#1A1A1A' }}>PLANES Y SUSCRIPCIÓN</h1>
                <p style={{ color: '#666' }}>Potencia tu negocio con las herramientas avanzadas de Admin.com</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                {plans.map((plan) => (
                    <motion.div 
                        key={plan.id}
                        whileHover={{ y: -5 }}
                        className="card-sanjose" 
                        style={{ 
                            padding: '3rem', 
                            position: 'relative',
                            borderTop: `8px solid ${plan.color}`,
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'white',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
                        }}
                    >
                        {plan.recommended && (
                            <div style={{ 
                                position: 'absolute', top: '-18px', right: '30px', 
                                background: '#E30613', color: 'white', padding: '6px 20px', 
                                borderRadius: '25px', fontSize: '0.75rem', fontWeight: '900',
                                boxShadow: '0 4px 10px rgba(227,6,19,0.3)'
                            }}>MÁS POPULAR</div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                            {plan.icon}
                            <h3 style={{ fontWeight: '900', fontSize: '1.5rem', color: '#1A1A1A' }}>{plan.name}</h3>
                        </div>

                        <div style={{ margin: '1rem 0 2rem 0' }}>
                            <span style={{ fontSize: '2.8rem', fontWeight: '950', color: plan.color }}>
                                {plan.price === 0 ? 'GRATIS' : formatCurrency(plan.price)}
                            </span>
                            {plan.price > 0 && <span style={{ fontSize: '1rem', color: '#888' }}> / mes</span>}
                        </div>

                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#999', marginBottom: '1.5rem', textTransform: 'uppercase' }}>Lo que incluye:</p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {plan.features.map(f => (
                                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', fontSize: '0.95rem', color: '#444' }}>
                                        <CheckCircle size={18} color="#27ae60" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ marginTop: '3rem' }}>
                            {plan.isCurrent ? (
                                <div style={{ textAlign: 'center', padding: '15px', background: '#F2F2F2', borderRadius: '12px', color: '#888', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={20} color="#27ae60" /> ESTÁS EN ESTE PLAN
                                </div>
                            ) : (
                                <button 
                                    className="btn-sanjose"
                                    onClick={() => window.open(`https://wa.me/522411354984?text=Hola, me interesa activar el ${plan.name} en Admin.com`, '_blank')}
                                    style={{ width: '100%', padding: '18px', fontSize: '1.1rem', backgroundColor: plan.color }}
                                >
                                    ACTIVAR AHORA <ArrowRight size={20} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
