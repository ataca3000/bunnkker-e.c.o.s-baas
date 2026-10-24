"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import styles from './AdminAsistente.module.css';

export default function AdminAsistente() {
    const { siteConfig, products, formatCurrency, orders } = useCart();
    const [isOpen, setIsOpen] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);
    const [messages, setMessages] = useState<Array<{ role: string; content: React.ReactNode }>>([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowGreeting(false);
        }, 8000);
        return () => clearTimeout(timer);
    }, []);

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { profile, user } = useAuth();
    const pathname = usePathname();
    const isOwner = pathname?.startsWith('/dashboard');

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isOwner) {
            setMessages([
                { 
                    role: 'assistant', 
                    content: `¡Hola Jefe! Soy LION 🦁, tu Gerente Inteligente en BUNKKER E.C.O.S. Monitoreo existencias, ventas y coordino tu operación en tiempo real. ¿Qué métricas o productos deseas revisar hoy?` 
                }
            ]);
        } else {
            setMessages([
                { 
                    role: 'assistant', 
                    content: `¡Hola! Soy LION 🦁, el asistente virtual de ${siteConfig.businessName || 'BUNKKER E.C.O.S'}. ¿En qué te puedo asesorar hoy respecto a nuestros productos, cotizaciones o pedidos?` 
                }
            ]);
        }
    }, [isOwner, siteConfig.businessName]);

    const handleSend = async (messageText?: string) => {
        const textToSend = messageText || input;
        if (!textToSend.trim()) return;

        const userMsg = textToSend.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsTyping(true);
        try {
            // --- PASO PREVIO: RESOLUCIÓN SEMÁNTICA LOCAL POR TÓPICOS ---
            if (isOwner) {
                try {
                    const intentRes = await fetch('/api/ai/resolve-intent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: userMsg })
                    });
                    if (intentRes.ok) {
                        const intentData = await intentRes.json();
                        if (intentData.success && intentData.data && intentData.data.intent !== 'unknown' && intentData.data.confidence >= 0.6) {
                            const { label, redirect, confidence } = intentData.data;
                            setMessages(prev => [...prev, { 
                                role: 'assistant', 
                                content: (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <p>Jefe, detecto que deseas realizar operaciones en: <strong>{label}</strong> (Confianza semántica local: {Math.round(confidence * 100)}%).</p>
                                        <Link href={redirect} onClick={() => setIsOpen(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 'bold', textDecoration: 'underline' }}>
                                            👉 Acceder a {label}
                                        </Link>
                                    </div>
                                )
                            }]);
                            setIsTyping(false);
                            return; // Detener ejecución para no ir a la IA remota
                        }
                    }
                } catch (intentErr) {
                    console.warn("[Asistente] Error en resolvedor semántico local:", intentErr);
                }
            }

            let botReply = "";
            const queryText = userMsg.toLowerCase();
            const bName = siteConfig.businessName || 'nuestro negocio';
            const bPhone = siteConfig.businessPhone || '55 1234 5678';

            if (isOwner) {
                // Respuestas del modo Gerente / Propietario
                if (queryText.includes('picking') || queryText.includes('recolect') || queryText.includes('surtir') || queryText.includes('preparar')) {
                    const pendingOrders = orders ? orders.filter((o: any) => !o.isLoaded && !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status)) : [];
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <p>📦 <strong>Asistente de Recolección (Picking IA):</strong></p>
                                <p>Actualmente hay <strong>{pendingOrders.length} pedido(s)</strong> pendientes de surtido en sucursal/almacén.</p>
                                {pendingOrders.slice(0, 3).map((o: any) => (
                                    <div key={o.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem' }}>
                                        <strong>{o.id}</strong> - {o.customerName || o.customer?.name || 'Cliente'} ({o.items?.length || 0} ítems)
                                    </div>
                                ))}
                                <Link 
                                    href="/dashboard/sales" 
                                    onClick={() => setIsOpen(false)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 'bold', textDecoration: 'underline', marginTop: '4px' }}
                                >
                                    👉 Abrir Surtidor / Ventas con Asistente IA
                                </Link>
                            </div>
                        )
                    }]);
                    setIsTyping(false);
                    return;
                }

                if (queryText.includes('deconstru') || queryText.includes('devolucion') || queryText.includes('regresar') || queryText.includes('anaquel')) {
                    const cancelledOrders = orders ? orders.filter((o: any) => o.status === 'CANCELLED' || o.status === 'REFUNDED') : [];
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <p>↩️ <strong>Deconstrucción y Devolución a Anaqueles:</strong></p>
                                <p>Hay <strong>{cancelledOrders.length} pedido(s)</strong> cancelados o reembolsados listos para regresar productos a sus estantes físicos.</p>
                                <Link 
                                    href="/dashboard/sales" 
                                    onClick={() => setIsOpen(false)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#d97706', fontWeight: 'bold', textDecoration: 'underline' }}
                                >
                                    👉 Ir a Ventas / Deconstrucción Asistida
                                </Link>
                            </div>
                        )
                    }]);
                    setIsTyping(false);
                    return;
                }

                if (queryText.includes('cancelacion') || queryText.includes('error') || queryText.includes('fallo') || queryText.includes('alerta') || queryText.includes('stock bajo') || queryText.includes('inventario')) {
                    const lowStock = products ? products.filter((p: any) => p.stock < 5) : [];
                    let ticketText = "";
                    try {
                        const res = await fetch('/api/tickets');
                        if (res.ok) {
                            const tickets = await res.json();
                            const pending = tickets.filter((t: any) => t.status === 'Pendiente (IA)' || t.status === 'Pendiente');
                            if (pending.length > 0) {
                                ticketText = ` Además, tienes ${pending.length} quejas/tickets de soporte pendientes de revisión.`;
                            }
                        }
                    } catch (e) {
                        console.error('Error fetching tickets', e);
                    }

                    if (lowStock.length > 0) {
                        botReply = `Jefe, tenemos alertas de inventario bajo. Los siguientes productos tienen menos de 5 unidades:\n\n` + 
                            lowStock.map((p: any) => `• **${p.name}** (${p.stock} pzas)`).join('\n') + 
                            `.\n\n${ticketText}`;
                    }
                }
            }
            
            // Determine Role dynamically
            let aiRole = 'customer';
            const storedRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || localStorage.getItem('CURRENT_ROLE')) : null;
            const currentRole = profile?.role || storedRole;

            if (isOwner || currentRole === 'admin' || currentRole === 'superadmin') {
                aiRole = 'superadmin';
            } else if (currentRole === 'sales') {
                aiRole = 'sales';
            } else if (currentRole === 'inventory' || currentRole === 'bodega') {
                aiRole = 'inventory';
            } else if (currentRole === 'driver' || currentRole === 'carga_descarga' || currentRole === 'patio') {
                aiRole = 'driver';
            } else if (currentRole === 'billing') {
                aiRole = 'billing';
            }

            // Build Context
            let contextData: any = { businessName: siteConfig?.businessName || 'BUNKKER E.C.O.s.' };
            if (aiRole === 'superadmin') {
                contextData.products = products?.map((p:any) => ({name: p.name, stock: p.stock, price: p.price}));
                contextData.ordersCount = orders?.length;
                contextData.activeModules = (siteConfig as any)?.activeModules;
            } else if (aiRole === 'sales') {
                contextData.products = products?.map((p:any) => ({name: p.name, price: p.price, stock: p.stock}));
            } else if (aiRole === 'inventory') {
                contextData.products = products?.map((p:any) => ({name: p.name, location: p.location || 'Bodega Principal', stock: p.stock}));
            } else if (aiRole === 'driver') {
                contextData.ordersCount = orders?.length;
                contextData.products = products?.map((p:any) => ({name: p.name, stock: p.stock}));
            } else {
                contextData.products = products?.filter((p:any) => p.stock > 0).map((p:any) => ({name: p.name, price: p.price, desc: p.description}));
            }

            // Client Ticket Override: If the user says "queja:" or "ticket:", we create it first!
            const queryTextTrimmed = userMsg.toLowerCase().trim();
            if (queryTextTrimmed.startsWith('queja:') || queryTextTrimmed.startsWith('ticket:')) {
                const complaintMsg = userMsg.replace(/^(queja|ticket):\s*/i, '').trim();
                if (complaintMsg) {
                    const folio = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
                    try {
                        await fetch('/api/tickets', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                folio,
                                customerEmail: profile?.email || user?.email || 'anonimo@tienda.com',
                                customerName: profile?.displayName || user?.displayName || 'Anónimo',
                                message: complaintMsg
                            })
                        });
                    } catch (e) {
                        console.error('Error saving ticket', e);
                    }
                    
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: `✅ **Ticket Registrado:** ${folio}\nHe recibido tu caso y lo he asignado a mi bandeja. Buscaré solucionarlo o lo enviaré al equipo humano de ${siteConfig?.businessName || 'la tienda'}.` 
                    }]);
                    setIsTyping(false);
                    return;
                }
            }

            const storedKey = typeof window !== 'undefined' ? localStorage.getItem('bunkker_gemini_key') : null;
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(storedKey ? { 'x-gemini-key': storedKey } : {})
                },
                body: JSON.stringify({
                    messages: messages.concat([{ role: 'user', content: userMsg }]),
                    contextData,
                    role: aiRole
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: data.reply || "Modo local activo. ¿Qué productos o precios deseas consultar en el catálogo?" 
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            }
        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, tuve un problema interno al procesar tu mensaje." }]);
        } finally {
            setIsTyping(false);
        }
    if (pathname === '/dashboard/sales') {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-20 md:bottom-20 right-4 md:right-6 z-[9999] flex flex-col items-end gap-2.5">
                <AnimatePresence>
                    {!isOpen && showGreeting && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{
                                background: isOwner ? '#1E293B' : 'white',
                                padding: '10px 16px',
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                fontSize: '0.9rem',
                                color: isOwner ? '#F8FAFC' : '#1E293B',
                                fontWeight: '600',
                                border: isOwner ? '1px solid #334155' : '1px solid #E2E8F0',
                                position: 'relative',
                                cursor: 'pointer'
                            }}
                            onClick={() => { setIsOpen(true); setShowGreeting(false); }}
                        >
                            {isOwner ? '⚡ Reporte Gerencial Listo' : '¡Hola! ¿Necesitas ayuda? 👋'}
                            <div style={{ position: 'absolute', bottom: '-6px', right: '20px', width: '12px', height: '12px', background: isOwner ? '#1E293B' : 'white', transform: 'rotate(45deg)', borderRight: isOwner ? '1px solid #334155' : '1px solid #E2E8F0', borderBottom: isOwner ? '1px solid #334155' : '1px solid #E2E8F0' }}></div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    onClick={() => { setIsOpen(true); setShowGreeting(false); }}
                    aria-label="Abrir chat de soporte"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className={`${styles.fab} ${isOpen ? styles.fabHidden : ''}`}
                    style={{ position: 'relative', right: 'auto', bottom: 'auto', background: isOwner ? '#0f172a' : undefined }}
                >
                    <span style={{ fontSize: '28px', lineHeight: 1 }}>🦁</span>
                </motion.button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 50 }}
                        className={`${styles.chatWindow} !bottom-20 !right-4 md:!right-6`}
                    >
                        <div className={styles.chatHeader} style={isOwner ? { background: '#0f172a' } : {}}>
                            <div className={styles.chatHeaderTitle}>
                                <span style={{ fontSize: '22px' }}>🦁</span>
                                <span className={styles.chatHeaderLabel}>{isOwner ? 'LION — GERENTE INTELIGENTE' : 'LION — ASISTENTE VIRTUAL'}</span>
                            </div>
                            <X size={20} className={styles.chatClose} onClick={() => setIsOpen(false)} />
                        </div>

                        <div className={styles.chatWarning} style={{ background: 'rgba(14, 165, 233, 0.08)', color: '#0284c7', borderBottom: '1px solid rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={13} className="text-sky-500 animate-pulse flex-shrink-0" />
                            <span><strong>BUNKKER E.C.O.S & LION:</strong> Gerente que personaliza y coordina tu operación.</span>
                        </div>

                        <div ref={scrollRef} className={styles.chatBody}>
                            {messages.map((m, i) => (
                                <div key={i} className={m.role === 'user' ? styles.msgUser : styles.msgBot} style={isOwner && m.role === 'assistant' ? { background: '#f1f5f9', borderLeft: '3px solid #38bdf8' } : {}}>
                                    {m.content}
                                </div>
                            ))}
                            {isTyping && <div className={styles.typing}>{isOwner ? 'Analizando operaciones...' : 'Escribiendo...'}</div>}
                        </div>

                        {/* Quick Action Chips */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            padding: '8px 12px',
                            overflowX: 'auto',
                            background: '#fafafa',
                            borderTop: '1px solid #f1f5f9',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                        }}>
                            {isOwner ? (
                                <>
                                    <button onClick={() => handleSend('recolectar pedido picking')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #38bdf8', background: '#f0f9ff', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0284c7' }}>📦 Picking IA</button>
                                    <button onClick={() => handleSend('deconstruir pedido devolucion')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #f59e0b', background: '#fffbeb', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#b45309' }}>↩️ Deconstruir</button>
                                    <button onClick={() => handleSend('resumen de ventas')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>📊 Ventas</button>
                                    <button onClick={() => handleSend('alertas de inventario')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>⚠️ Stock Bajo</button>
                                    <button onClick={() => handleSend('quejas de clientes')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>📨 Quejas</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => handleSend('ofertas')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#e30613' }}>🔍 Ofertas</button>
                                    <button onClick={() => handleSend('horarios')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#e30613' }}>🕒 Horarios</button>
                                    <button onClick={() => handleSend('registrar queja')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#e30613' }}>🎟️ Registrar Queja</button>
                                    <button onClick={() => handleSend('mis quejas')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#e30613' }}>📋 Mis Quejas</button>
                                    <button onClick={() => handleSend('como comprar')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#e30613' }}>🛒 ¿Cómo Comprar?</button>
                                </>
                            )}
                        </div>

                        <div className={styles.chatInputArea}>
                            <input
                                type="text"
                                value={input}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isOwner ? "Consulta métricas, inventario o alertas..." : "Haz una pregunta..."}
                                className={styles.chatInput}
                            />
                            <button
                                onClick={() => handleSend()}
                                aria-label="Enviar mensaje"
                                className={styles.chatSendBtn}
                                style={isOwner ? { background: '#0f172a' } : {}}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
