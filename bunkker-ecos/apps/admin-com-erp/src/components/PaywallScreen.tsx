"use client";

import React, { useState } from 'react';
import { ShieldAlert, CreditCard, Lock, CheckCircle2, Clock } from 'lucide-react';
import type { LicenseInfo } from '@bunkker/core';

export default function PaywallScreen({ license }: { license: LicenseInfo }) {
    const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const handleStripeSimulation = () => {
        setIsSimulatingPayment(true);
        // Simulate Stripe API call and Webhook trigger
        setTimeout(async () => {
            try {
                // En producción, esto redirigiría a Checkout de Stripe.
                // Aquí simulamos que se pagó y el webhook local extendió la suscripción.
                const res = await fetch('/api/drm/simulate-payment', { method: 'POST' });
                if (res.ok) {
                    setPaymentSuccess(true);
                    setTimeout(() => {
                        window.location.reload(); // Recargar para volver a checar la licencia
                    }, 2000);
                }
            } catch (err) {
                console.error("Payment failed", err);
            }
            setIsSimulatingPayment(false);
        }, 2000);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'sans-serif' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '3rem', maxWidth: '600px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, #ef4444, #f59e0b)' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <Lock size={64} color="#ef4444" />
                    </div>
                </div>

                <h1 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '1rem', textTransform: 'uppercase' }}>
                    Suscripción Expirada
                </h1>
                
                <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: 1.6 }}>
                    Tu periodo de {license.isTrial ? 'prueba de 15 días' : 'suscripción'} ha terminado. 
                    Tus datos, inventario y finanzas están seguros en tu computadora local, pero requieres 
                    reactivar tu licencia para seguir utilizando <strong>BUNKKER E.C.O.S</strong>.
                </p>

                <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Detalles del Equipo</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Hardware ID:</span>
                        <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}>{license.hwid.substring(0,16)}...</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Fecha de Instalación:</span>
                        <span style={{ color: '#e2e8f0' }}>{new Date(license.installDate).toLocaleDateString()}</span>
                    </div>
                </div>

                {paymentSuccess ? (
                    <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '2rem', borderRadius: '16px', color: '#22c55e' }}>
                        <CheckCircle2 size={48} style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>¡Pago Exitoso!</h2>
                        <p style={{ fontSize: '0.9rem' }}>Reactivando sistema...</p>
                    </div>
                ) : (
                    <button 
                        onClick={handleStripeSimulation}
                        disabled={isSimulatingPayment}
                        style={{ 
                            width: '100%', padding: '1.2rem', borderRadius: '12px', 
                            backgroundColor: '#0ea5e9', color: 'white', fontWeight: 'bold', 
                            fontSize: '1.1rem', border: 'none', cursor: isSimulatingPayment ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            opacity: isSimulatingPayment ? 0.7 : 1
                        }}
                    >
                        {isSimulatingPayment ? (
                            <>Procesando Pago...</>
                        ) : (
                            <>
                                <CreditCard /> Pagar Reactivación ($X USD)
                            </>
                        )}
                    </button>
                )}

                <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <ShieldAlert size={14} /> Sistema Protegido por Bunkker DRM
                </div>
            </div>
        </div>
    );
}
