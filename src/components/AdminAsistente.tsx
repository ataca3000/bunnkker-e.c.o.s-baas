"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import styles from './AdminAsistente.module.css';

export default function AdminAsistente() {
    const { siteConfig, products, formatCurrency, orders } = useCart();
    const [isOpen, setIsOpen] = useState(false);
    const [showGreeting, setShowGreeting] = useState(true);
    const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

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
                    content: `¡Hola Jefe! Soy tu Asistente Gerente 24/7. El sistema está operando con normalidad. En la versión PRO podré analizar a tus competidores y sugerirte precios con IA avanzada (Gemini). Por ahora, ¿qué métricas o alertas necesitas revisar hoy?` 
                }
            ]);
        } else {
            setMessages([
                { 
                    role: 'assistant', 
                    content: `¡Hola! Soy el asistente virtual de ${siteConfig.businessName || 'tu negocio'}. ¿En qué te puedo asesorar hoy respecto a nuestros productos, cotizaciones o soporte?` 
                }
            ]);
        }
    }, [siteConfig.businessName, isOwner]);

    const handleSend = async (messageText?: string) => {
        const textToSend = messageText || input;
        if (!textToSend.trim()) return;

        const userMsg = textToSend.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsTyping(true);

        try {
            let botReply = "";
            const queryText = userMsg.toLowerCase();
            const bName = siteConfig.businessName || 'nuestro negocio';
            const bPhone = siteConfig.businessPhone || '55 1234 5678';

            if (isOwner) {
                // Respuestas del modo Gerente / Propietario
                if (queryText.includes('cancelacion') || queryText.includes('error') || queryText.includes('fallo') || queryText.includes('alerta') || queryText.includes('stock bajo') || queryText.includes('inventario')) {
                    const lowStock = products ? products.filter((p: any) => p.stock < 5) : [];
                    let ticketText = "";
                    try {
                        const ticketsSnap = await getDocs(collection(db, 'tickets'));
                        const pending = ticketsSnap.docs.filter((d: any) => d.data().status === 'pendiente');
                        if (pending.length > 0) {
                            ticketText = ` Además, tienes ${pending.length} quejas/tickets de soporte pendientes de revisión.`;
                        }
                    } catch (e) {}

                    if (lowStock.length > 0) {
                        botReply = `Jefe, tenemos alertas de inventario bajo. Los siguientes productos tienen menos de 5 unidades:\n\n` + 
                            lowStock.map((p: any) => `• **${p.name}** (${p.stock} pzas)`).join('\n') + 
                            `.\n\n${ticketText}`;
                    }
                }
            }
            
            // Determine Role
            let aiRole = 'customer';
            if (isOwner) aiRole = 'superadmin';
            else if (profile?.role === 'admin' || profile?.role === 'marketing' || profile?.role === 'inventory' || profile?.role === 'sales') {
                aiRole = 'staff';
            }

            // Build Context
            let contextData: any = { businessName: siteConfig?.businessName || 'BUNKKER E.C.O.S' };
            if (aiRole === 'superadmin') {
                contextData.products = products?.map((p:any) => ({name: p.name, stock: p.stock, price: p.price}));
                contextData.ordersCount = orders?.length;
                contextData.activeModules = (siteConfig as any)?.activeModules;
            } else if (aiRole === 'staff') {
                contextData.products = products?.map((p:any) => ({name: p.name, location: p.location || 'Bodega General', stock: p.stock}));
            } else {
                contextData.products = products?.filter((p:any) => p.stock > 0).map((p:any) => ({name: p.name, price: p.price, desc: p.description}));
            }

            // Client Ticket Override: If the user says "queja:" or "ticket:", we create it first!
            const queryTextTrimmed = userMsg.toLowerCase().trim();
            if (queryTextTrimmed.startsWith('queja:') || queryTextTrimmed.startsWith('ticket:')) {
                const complaintMsg = userMsg.replace(/^(queja|ticket):\s*/i, '').trim();
                if (complaintMsg) {
                    const folio = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
                    await addDoc(collection(db, 'support_tickets'), {
                        folio,
                        customerEmail: profile?.email || user?.email || 'anonimo@tienda.com',
                        customerName: profile?.displayName || user?.displayName || 'Anónimo',
                        message: complaintMsg,
                        status: 'Pendiente (IA)',
                        createdAt: serverTimestamp()
                    });
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: `✅ **Ticket Registrado:** ${folio}\nHe recibido tu caso y lo he asignado a mi bandeja. Buscaré solucionarlo o lo enviaré al equipo humano de ${siteConfig?.businessName || 'la tienda'}.` 
                    }]);
                    setIsTyping(false);
                    return;
                }
            }

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages.concat([{ role: 'user', content: userMsg }]),
                    contextData,
                    role: aiRole
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                // Si la API falla (ej. sin KEY), caemos en un fallback elegante.
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: `Modo Local Activo: ${data.error || 'No se pudo contactar a Gemini'}. \n(Para habilitar IA avanzada, añade GEMINI_API_KEY en tu .env o Setup).` 
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
    };

    return (
        <>
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
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
                    {isOwner ? <Sparkles size={30} color="#38bdf8" /> : <Bot size={30} />}
                </motion.button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 50 }}
                        className={styles.chatWindow}
                    >
                        <div className={styles.chatHeader} style={isOwner ? { background: '#0f172a' } : {}}>
                            <div className={styles.chatHeaderTitle}>
                                {isOwner ? <Sparkles size={20} color="#38bdf8" /> : <Sparkles size={20} color="#FFCB05" />}
                                <span className={styles.chatHeaderLabel}>{isOwner ? 'ASISTENTE GERENTE (PRO PREVIEW)' : 'ASISTENTE VIRTUAL AI'}</span>
                            </div>
                            <X size={20} className={styles.chatClose} onClick={() => setIsOpen(false)} />
                        </div>

                        <div className={styles.chatWarning} style={isOwner ? { background: '#fdf4ff', color: '#a21caf' } : {}}>
                            <AlertTriangle size={12} /> {isOwner ? 'Actualiza a PRO para IA Autónoma (Gemini) y Análisis de Competencia.' : `Soporte inteligente activo para ${siteConfig.businessName || 'la tienda'}.`}
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
                                    <button onClick={() => handleSend('resumen de ventas')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>📊 Ventas</button>
                                    <button onClick={() => handleSend('alertas de inventario')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>⚠️ Stock Bajo</button>
                                    <button onClick={() => handleSend('quejas de clientes')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>📨 Quejas Recibidas</button>
                                    <button onClick={() => handleSend('sugerencias de precios')} style={{ padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', color: '#0ea5e9' }}>💡 Sugerir Precios</button>
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
