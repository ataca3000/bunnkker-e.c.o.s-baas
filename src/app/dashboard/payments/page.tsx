"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Wallet, Landmark, Smartphone, CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';

const methods = [
    { id: 'card', name: 'Tarjeta de Crédito/Débito', icon: <CreditCard size={24} />, desc: 'Visa, Mastercard, AMEX', preferred: false },
    { id: 'transfer', name: 'Transferencia SPEI', icon: <Landmark size={24} />, desc: 'Confirmación inmediata 24/7', preferred: true },
    { id: 'oxxo', name: 'Efectivo en Tiendas', icon: <Smartphone size={24} />, desc: 'OXXO Pay, 7-Eleven', preferred: false },
    { id: 'wallet', name: 'Billeteras Digitales', icon: <Wallet size={24} />, desc: 'Apple Pay, Google Pay', preferred: false },
];

export default function PaymentsNode() {
    const [selected, setSelected] = useState('transfer');
    const [isConfiguring, setIsConfiguring] = useState(false);

    return (
        <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2.5rem' }}>
                    <h1 className="heading-sanjose">CONFIGURACIÓN DE PAGOS</h1>
                    <p style={{ color: '#666' }}>Define los métodos aceptados en el marketplace y establece tu favorito.</p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

                    {/* List of Methods */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {methods.map((m) => (
                            <div
                                key={m.id}
                                onClick={() => setSelected(m.id)}
                                className="card-sanjose"
                                style={{
                                    cursor: 'pointer',
                                    borderColor: selected === m.id ? '#0ea5e9' : '#ddd',
                                    backgroundColor: selected === m.id ? '#F0F7FF' : 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.5rem'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ color: selected === m.id ? '#0ea5e9' : '#888' }}>{m.icon}</div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{m.name}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{m.desc}</div>
                                    </div>
                                </div>
                                {m.preferred && (
                                    <span style={{ fontSize: '0.65rem', backgroundColor: '#FFCB05', color: '#0ea5e9', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>PREFERIDO</span>
                                )}
                                {selected === m.id && <CheckCircle color="#0ea5e9" size={20} />}
                            </div>
                        ))}
                    </div>

                    {/* Configuration Panel */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selected}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="card-sanjose"
                            style={{ height: 'fit-content', background: '#0ea5e9', color: 'white', borderColor: '#0ea5e9' }}
                        >
                            <h3 style={{ marginBottom: '1rem', color: '#FFCB05' }}>AJUSTES: {selected.toUpperCase()}</h3>
                            <p style={{ fontSize: '0.85rem', marginBottom: '2rem', opacity: 0.8 }}>
                                Configura las llaves de API o cuentas bancarias para recibir pagos automáticamente.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>CUENTA DE DEPÓSITO</label>
                                    <input type="text" placeholder="#### #### #### ####" style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', marginTop: '5px' }} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem' }}>
                                    <input type="checkbox" checked={selected === 'transfer'} id="fav" />
                                    <label htmlFor="fav" style={{ fontSize: '0.8rem' }}>Establecer como método preferido</label>
                                </div>

                                <button
                                    className="btn-sanjose-secondary"
                                    style={{ marginTop: '1rem', width: '100%' }}
                                    onClick={() => {
                                        setIsConfiguring(true);
                                        setTimeout(() => setIsConfiguring(false), 2000);
                                    }}
                                >
                                    {isConfiguring ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                                </button>
                            </div>

                            <div style={{ marginTop: '2rem', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ShieldCheck size={20} color="#FFCB05" />
                                <span style={{ fontSize: '0.7rem' }}>Transacciones protegidas con cifrado AES-256.</span>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
