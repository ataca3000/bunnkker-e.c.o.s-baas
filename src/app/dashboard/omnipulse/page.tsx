'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NETWORKS, type NetworkId, type OmniAccountSummary, type DispatchResult } from '@/lib/omnipulse/types';
import { generateVariations, countCombinations } from '@/lib/omnipulse/spintax';

// ─── TIPOS LOCALES ─────────────────────────────────────────────────────────────
type Tab = 'accounts' | 'composer' | 'monitor' | 'logs';

interface LocalAccount extends OmniAccountSummary {
    _token: string;
    _channelId?: string;
}

interface LogEntry {
    postId: string;
    timestamp: string;
    networksCount: number;
    successCount: number;
    failCount: number;
    results: DispatchResult[];
    preview: string;
}

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];
const GROUPS = {
    A: NETWORK_IDS.filter(n => NETWORKS[n].group === 'A'),
    B: NETWORK_IDS.filter(n => NETWORKS[n].group === 'B'),
    C: NETWORK_IDS.filter(n => NETWORKS[n].group === 'C'),
};

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function OmniPulseDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('accounts');
    const [accounts, setAccounts] = useState<LocalAccount[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [postBody, setPostBody] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [useSpintax, setUseSpintax] = useState(false);
    const [spintaxPreviews, setSpintaxPreviews] = useState<string[]>([]);
    const [isDispatching, setIsDispatching] = useState(false);
    const [dispatchResults, setDispatchResults] = useState<DispatchResult[]>([]);
    const [currentPostId, setCurrentPostId] = useState<string | null>(null);
    const [dispatchDone, setDispatchDone] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectingNetwork, setConnectingNetwork] = useState<NetworkId | null>(null);
    const [connectForm, setConnectForm] = useState({ accountName: '', token: '', channelId: '' });
    const [connecting, setConnecting] = useState(false);
    const sseRef = useRef<EventSource | null>(null);

    // ─── SPINTAX PREVIEW ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!useSpintax || !postBody) { setSpintaxPreviews([]); return; }
        const timer = setTimeout(() => {
            const previews = generateVariations(postBody + (hashtags ? `\n\n${hashtags}` : ''), 3);
            setSpintaxPreviews(previews);
        }, 400);
        return () => clearTimeout(timer);
    }, [postBody, hashtags, useSpintax]);

    // ─── CONECTAR CUENTA ──────────────────────────────────────────────────────
    const handleConnect = async () => {
        if (!connectingNetwork || !connectForm.accountName || !connectForm.token) return;
        setConnecting(true);
        try {
            const res = await fetch('/api/omnipulse/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    network: connectingNetwork,
                    accountName: connectForm.accountName,
                    accountId: connectForm.accountName.toLowerCase().replace(/\s/g, '_'),
                    accessToken: connectForm.token,
                    channelId: connectForm.channelId || undefined,
                }),
            });
            const data = await res.json();
            if (data.account) {
                const newAcc: LocalAccount = {
                    ...data.account,
                    _token: connectForm.token,
                    _channelId: connectForm.channelId || undefined,
                };
                setAccounts(prev => [...prev.filter(a =>
                    !(a.network === connectingNetwork && a.accountName === connectForm.accountName)
                ), newAcc]);
                setConnectForm({ accountName: '', token: '', channelId: '' });
                setShowConnectModal(false);
                setConnectingNetwork(null);
            }
        } finally {
            setConnecting(false);
        }
    };

    // ─── DESCONECTAR CUENTA ────────────────────────────────────────────────────
    const handleDisconnect = (accountId: string) => {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        setSelectedAccounts(prev => { const s = new Set(prev); s.delete(accountId); return s; });
    };

    // ─── TOGGLE SELECCIÓN ────────────────────────────────────────────────────
    const toggleAccount = (id: string) => {
        setSelectedAccounts(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    const selectAll = () => setSelectedAccounts(new Set(accounts.map(a => a.id)));
    const selectNone = () => setSelectedAccounts(new Set());

    // ─── DESPACHAR PUBLICACIÓN ─────────────────────────────────────────────────
    const handleDispatch = async () => {
        if (!postBody.trim() || selectedAccounts.size === 0) return;
        const postId = `omni_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setCurrentPostId(postId);
        setIsDispatching(true);
        setDispatchDone(false);
        setActiveTab('monitor');

        const targetAccounts = accounts.filter(a => selectedAccounts.has(a.id));

        // Inicializar resultados en pending
        setDispatchResults(targetAccounts.map(acc => ({
            accountId: acc.id,
            network: acc.network,
            accountName: acc.accountName,
            status: 'pending',
        })));

        try {
            await fetch('/api/omnipulse/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    postBody,
                    hashtags,
                    useSpintax,
                    mediaUrls: [],
                    accounts: targetAccounts.map(acc => ({
                        id: acc.id,
                        network: acc.network,
                        accountName: acc.accountName,
                        token: acc._token,
                        channelId: acc._channelId,
                    })),
                }),
            });

            // Conectar SSE para actualizaciones en vivo
            if (sseRef.current) sseRef.current.close();
            const sse = new EventSource(`/api/omnipulse/status/${postId}`);
            sseRef.current = sse;

            sse.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.results) setDispatchResults(data.results);
                if (data.done) {
                    setIsDispatching(false);
                    setDispatchDone(true);
                    sse.close();
                    // Guardar en log
                    const finalResults = data.results as DispatchResult[];
                    const successCount = finalResults.filter(r => r.status === 'success').length;
                    setLogs(prev => [{
                        postId,
                        timestamp: new Date().toISOString(),
                        networksCount: finalResults.length,
                        successCount,
                        failCount: finalResults.length - successCount,
                        results: finalResults,
                        preview: postBody.slice(0, 80),
                    }, ...prev].slice(0, 50));
                }
            };
            sse.onerror = () => { setIsDispatching(false); sse.close(); };
        } catch (err) {
            setIsDispatching(false);
        }
    };

    // ─── CHARCOUNT ────────────────────────────────────────────────────────────
    const charCount = postBody.length + (hashtags ? hashtags.length + 2 : 0);

    return (
        <main className="min-h-screen p-6 lg:p-10 max-w-[1400px] mx-auto">

            {/* ── HEADER ── */}
            <header className="mb-8 flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-lg font-black shadow-lg shadow-purple-500/30">
                            ⚡
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                            OMNIPULSE
                        </h1>
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400/60 border border-purple-500/30 px-2 py-0.5 rounded-full">
                            by BUNKKER
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                        Un pulso · {NETWORK_IDS.length} voces · Publicación masiva orgánica
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm">
                        <span className="text-slate-400">Cuentas:</span>
                        <span className="ml-2 font-bold text-green-400">{accounts.length}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-slate-300">{NETWORK_IDS.length}</span>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm">
                        <span className="text-slate-400">Seleccionadas:</span>
                        <span className="ml-2 font-bold text-purple-400">{selectedAccounts.size}</span>
                    </div>
                    {accounts.length > 0 && (
                        <button
                            onClick={handleDispatch}
                            disabled={selectedAccounts.size === 0 || !postBody.trim() || isDispatching}
                            className="px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider 
                                       bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30
                                       hover:from-purple-500 hover:to-pink-500 transition-all duration-200
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       flex items-center gap-2"
                        >
                            {isDispatching ? (
                                <><span className="animate-spin">⟳</span> Publicando...</>
                            ) : (
                                <>⚡ PUBLICAR AHORA</>
                            )}
                        </button>
                    )}
                </div>
            </header>

            {/* ── TABS ── */}
            <div className="flex gap-1 mb-8 p-1 bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800/50 w-fit">
                {([
                    { id: 'accounts', label: 'Mis Cuentas',  icon: '🔑', badge: accounts.length || undefined },
                    { id: 'composer', label: 'Compositor',   icon: '✏️', badge: undefined },
                    { id: 'monitor',  label: 'Monitor Live', icon: '📡', badge: isDispatching ? '●' : undefined },
                    { id: 'logs',     label: 'Historial',    icon: '📋', badge: logs.length || undefined },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                            activeTab === tab.id
                                ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-lg shadow-purple-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge !== undefined && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1 ${
                                tab.badge === '●' ? 'text-green-400 animate-pulse' : 'bg-purple-500/30 text-purple-300'
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: MIS CUENTAS                                           */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'accounts' && (
                    <motion.div key="accounts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                Conecta tus Redes Sociales
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 font-bold transition-all">
                                    Sel. todas
                                </button>
                                <button onClick={selectNone} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 font-bold transition-all">
                                    Ninguna
                                </button>
                            </div>
                        </div>

                        {(['A', 'B', 'C'] as const).map(group => (
                            <div key={group} className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${
                                        group === 'A' ? 'bg-blue-500/20 text-blue-300' :
                                        group === 'B' ? 'bg-green-500/20 text-green-300' :
                                                        'bg-orange-500/20 text-orange-300'
                                    }`}>
                                        Grupo {group}
                                    </span>
                                    <span className="text-slate-500 text-xs">
                                        {group === 'A' ? 'OAuth 2.0 (Meta / LinkedIn / Google)' :
                                         group === 'B' ? 'Token Directo · Funcionan HOY' :
                                                         'Protocolos Abiertos · Federados'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {GROUPS[group].map(networkId => {
                                        const net = NETWORKS[networkId];
                                        const connectedAccs = accounts.filter(a => a.network === networkId);
                                        const hasAccount = connectedAccs.length > 0;
                                        const isSelected = connectedAccs.some(a => selectedAccounts.has(a.id));

                                        return (
                                            <div
                                                key={networkId}
                                                className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
                                                    hasAccount
                                                        ? isSelected
                                                            ? 'border-purple-500/60 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                                                            : 'border-slate-600/50 bg-slate-800/40'
                                                        : 'border-slate-700/30 bg-slate-900/30'
                                                }`}
                                            >
                                                {/* Selección si tiene cuenta */}
                                                {hasAccount && (
                                                    <div
                                                        className="cursor-pointer p-4 pb-2"
                                                        onClick={() => connectedAccs.forEach(a => toggleAccount(a.id))}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <span className="text-2xl">{net.icon}</span>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-600'
                                                            }`}>
                                                                {isSelected && <span className="text-white text-xs font-black">✓</span>}
                                                            </div>
                                                        </div>
                                                        <p className="text-white font-bold text-sm">{net.name}</p>
                                                        {connectedAccs.map(acc => (
                                                            <p key={acc.id} className="text-green-400 text-xs font-medium truncate">
                                                                ✓ {acc.accountName}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Sin cuenta: solo botón conectar */}
                                                {!hasAccount && (
                                                    <div className="p-4">
                                                        <span className="text-2xl mb-2 block opacity-40">{net.icon}</span>
                                                        <p className="text-slate-400 font-bold text-sm mb-3">{net.name}</p>
                                                    </div>
                                                )}

                                                {/* Acciones */}
                                                <div className="px-3 pb-3 flex gap-1.5">
                                                    <button
                                                        onClick={() => { setConnectingNetwork(networkId); setShowConnectModal(true); }}
                                                        className="flex-1 text-xs py-1.5 rounded-lg font-bold transition-all
                                                                   bg-slate-700/60 text-slate-300 hover:bg-purple-600/60 hover:text-white"
                                                    >
                                                        {hasAccount ? '+ Otra' : 'Conectar'}
                                                    </button>
                                                    {hasAccount && connectedAccs.map(acc => (
                                                        <button
                                                            key={acc.id}
                                                            onClick={() => handleDisconnect(acc.id)}
                                                            className="text-xs px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/30 font-bold transition-all"
                                                        >
                                                            ✕
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* TIP Grupo B */}
                        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                            <p className="text-green-400 font-bold text-sm mb-1">💡 Empieza ahora mismo sin configuración compleja</p>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                <strong className="text-white">Telegram:</strong> Crea un bot en @BotFather → copia el token → ponlo en "Token" · ID Canal = @tunombre_canal<br />
                                <strong className="text-white">Discord:</strong> En tu servidor ve a Configuración → Integraciones → Webhooks → Copiar URL del Webhook (ese es el "Token")<br />
                                <strong className="text-white">Bluesky:</strong> Token = "tu_usuario.bsky.social:tu_contraseña_de_app" · Mastodon: "instancia.social|tu_access_token"
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: COMPOSITOR                                             */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'composer' && (
                    <motion.div key="composer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                            {/* ── Editor Izquierdo ── */}
                            <div className="space-y-5">
                                <div className="card-sanjose p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-black text-white uppercase tracking-tight text-sm">
                                            ✏️ Contenido de la Publicación
                                        </h3>
                                        <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                            charCount > 2200 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700/50 text-slate-400'
                                        }`}>
                                            {charCount} chars
                                        </div>
                                    </div>

                                    <textarea
                                        value={postBody}
                                        onChange={e => setPostBody(e.target.value)}
                                        placeholder={useSpintax
                                            ? '{Hola|Buen día|Qué tal} {{nombre}}, {conoce|descubre|visita} nuestra oferta especial de hoy.'
                                            : 'Escribe tu publicación aquí. Aparecerá en todas las redes seleccionadas...'}
                                        rows={8}
                                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-sm text-slate-200 
                                                   placeholder-slate-600 outline-none focus:border-purple-500/60 transition-all resize-none font-mono"
                                    />

                                    <textarea
                                        value={hashtags}
                                        onChange={e => setHashtags(e.target.value)}
                                        placeholder="#ferreteria #construccion #CDMX #oferta"
                                        rows={2}
                                        className="w-full mt-3 bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-sm text-purple-300 
                                                   placeholder-slate-600 outline-none focus:border-purple-500/60 transition-all resize-none"
                                    />

                                    {/* Toggle Spintax */}
                                    <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                                        <div>
                                            <p className="text-sm font-bold text-white">Motor Spintax</p>
                                            <p className="text-xs text-slate-400">Genera variaciones únicas en cada red para evitar filtros</p>
                                        </div>
                                        <button
                                            onClick={() => setUseSpintax(!useSpintax)}
                                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                                                useSpintax ? 'bg-purple-500' : 'bg-slate-700'
                                            }`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                                                useSpintax ? 'translate-x-6' : 'translate-x-0'
                                            }`} />
                                        </button>
                                    </div>

                                    {useSpintax && postBody && (
                                        <div className="mt-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                                            <p className="text-xs text-purple-400 font-bold mb-1">
                                                {countCombinations(postBody).toLocaleString()} combinaciones posibles
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Cuentas seleccionadas */}
                                <div className="card-sanjose p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-black text-white uppercase tracking-tight text-sm">
                                            🎯 Destinos ({selectedAccounts.size}/{accounts.length})
                                        </h3>
                                        <div className="flex gap-2">
                                            <button onClick={selectAll} className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-bold hover:bg-purple-500/40 transition-all">
                                                Todas
                                            </button>
                                            <button onClick={selectNone} className="text-xs px-2.5 py-1 rounded-lg bg-slate-700/50 text-slate-400 font-bold hover:bg-slate-700 transition-all">
                                                Ninguna
                                            </button>
                                        </div>
                                    </div>

                                    {accounts.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-slate-500 text-sm">Conecta al menos una cuenta en "Mis Cuentas"</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {accounts.map(acc => {
                                                const net = NETWORKS[acc.network];
                                                const isSelected = selectedAccounts.has(acc.id);
                                                return (
                                                    <button
                                                        key={acc.id}
                                                        onClick={() => toggleAccount(acc.id)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 border ${
                                                            isSelected
                                                                ? 'text-white shadow-md'
                                                                : 'border-slate-700/50 text-slate-400 bg-slate-800/30 hover:border-slate-600'
                                                        }`}
                                                        style={isSelected ? {
                                                            backgroundColor: net.color + '20',
                                                            borderColor: net.color + '60',
                                                        } : undefined}
                                                    >
                                                        <span>{net.icon}</span>
                                                        <span className="max-w-[100px] truncate">{acc.accountName}</span>
                                                        {isSelected && <span className="text-xs opacity-60">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {accounts.length > 0 && selectedAccounts.size > 0 && postBody.trim() && (
                                        <button
                                            onClick={handleDispatch}
                                            disabled={isDispatching}
                                            className="w-full mt-5 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest
                                                       bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30
                                                       hover:from-purple-500 hover:to-pink-500 transition-all duration-200
                                                       disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isDispatching ? (
                                                <><span className="animate-spin text-lg">⟳</span> Publicando en {selectedAccounts.size} redes...</>
                                            ) : (
                                                <>⚡ PUBLICAR EN {selectedAccounts.size} REDES</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Preview Derecho ── */}
                            <div className="space-y-5">
                                {useSpintax && spintaxPreviews.length > 0 ? (
                                    <div className="card-sanjose p-6">
                                        <h3 className="font-black text-white uppercase tracking-tight text-sm mb-4">
                                            🎲 Variaciones Spintax (Vista Previa)
                                        </h3>
                                        <div className="space-y-3">
                                            {spintaxPreviews.map((preview, i) => (
                                                <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/30">
                                                    <span className="text-xs text-purple-400 font-bold mr-2">#{i + 1}</span>
                                                    <span className="text-sm text-slate-300">{preview}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : postBody && (
                                    <div className="space-y-3">
                                        <h3 className="font-black text-white uppercase tracking-tight text-sm">
                                            👁️ Vista Previa por Red
                                        </h3>
                                        {accounts.filter(a => selectedAccounts.has(a.id)).slice(0, 5).map(acc => {
                                            const net = NETWORKS[acc.network];
                                            const previewText = (postBody + (hashtags ? `\n\n${hashtags}` : '')).slice(0, net.charLimit);
                                            return (
                                                <div key={acc.id} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-lg">{net.icon}</span>
                                                        <span className="font-bold text-sm text-white">{net.name}</span>
                                                        <span className="ml-auto text-xs text-slate-500">{previewText.length}/{net.charLimit}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{previewText}</p>
                                                    {postBody.length > net.charLimit && (
                                                        <p className="text-xs text-orange-400 mt-2 font-bold">⚠ Texto truncado al límite de esta red</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {selectedAccounts.size > 5 && (
                                            <p className="text-xs text-slate-500 text-center">
                                                +{selectedAccounts.size - 5} redes más recibirán la misma publicación
                                            </p>
                                        )}
                                    </div>
                                )}

                                {!postBody && (
                                    <div className="card-sanjose p-8 text-center">
                                        <p className="text-4xl mb-4">✏️</p>
                                        <p className="text-slate-400 text-sm">
                                            Escribe tu publicación a la izquierda para ver la vista previa aquí
                                        </p>
                                        <p className="text-slate-600 text-xs mt-2">
                                            La vista previa se adapta al límite de caracteres de cada red
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: MONITOR LIVE                                          */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'monitor' && (
                    <motion.div key="monitor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="card-sanjose p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                        📡 Monitor de Despacho en Vivo
                                    </h2>
                                    {currentPostId && (
                                        <p className="text-xs text-slate-500 font-mono mt-1">{currentPostId}</p>
                                    )}
                                </div>
                                {dispatchDone && (
                                    <div className="px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30">
                                        <p className="text-green-400 font-black text-sm">✅ Despacho Completado</p>
                                        <p className="text-xs text-green-400/60">
                                            {dispatchResults.filter(r => r.status === 'success').length} éxitos ·{' '}
                                            {dispatchResults.filter(r => r.status === 'failed').length} fallos
                                        </p>
                                    </div>
                                )}
                            </div>

                            {dispatchResults.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-6xl mb-6">🌐</p>
                                    <p className="text-xl font-black text-slate-400 uppercase tracking-tight">
                                        Sin publicaciones activas
                                    </p>
                                    <p className="text-slate-500 text-sm mt-2">
                                        Ve al Compositor, selecciona cuentas y pulsa ⚡ PUBLICAR
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Barra de progreso global */}
                                    {isDispatching && (
                                        <div className="mb-8">
                                            <div className="flex justify-between text-xs text-slate-400 mb-2 font-bold">
                                                <span>Progreso global</span>
                                                <span>
                                                    {dispatchResults.filter(r => ['success', 'failed'].includes(r.status)).length} / {dispatchResults.length}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{
                                                        width: `${(dispatchResults.filter(r => ['success', 'failed'].includes(r.status)).length / dispatchResults.length) * 100}%`
                                                    }}
                                                    transition={{ duration: 0.5 }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Grid de resultados */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {dispatchResults.map(result => {
                                            const net = NETWORKS[result.network];
                                            return (
                                                <motion.div
                                                    key={result.accountId}
                                                    layout
                                                    className={`rounded-2xl p-4 border transition-all duration-500 ${
                                                        result.status === 'success'  ? 'border-green-500/40 bg-green-500/5' :
                                                        result.status === 'failed'   ? 'border-red-500/40 bg-red-500/5' :
                                                        result.status === 'publishing' ? 'border-purple-500/60 bg-purple-500/10 shadow-lg shadow-purple-500/20' :
                                                        'border-slate-700/30 bg-slate-800/20'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{net.icon}</span>
                                                            <div>
                                                                <p className="font-bold text-sm text-white leading-none">{net.name}</p>
                                                                <p className="text-xs text-slate-400 truncate max-w-[100px]">{result.accountName}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-lg">
                                                            {result.status === 'success'   ? '✅' :
                                                             result.status === 'failed'    ? '❌' :
                                                             result.status === 'publishing' ? <span className="animate-spin inline-block">⟳</span> :
                                                             '⏳'}
                                                        </span>
                                                    </div>

                                                    <div className={`text-xs font-bold px-2.5 py-1 rounded-lg w-fit ${
                                                        result.status === 'success'   ? 'bg-green-500/20 text-green-300' :
                                                        result.status === 'failed'    ? 'bg-red-500/20 text-red-300' :
                                                        result.status === 'publishing' ? 'bg-purple-500/20 text-purple-300 animate-pulse' :
                                                        'bg-slate-700/50 text-slate-400'
                                                    }`}>
                                                        {result.status === 'success'   ? 'PUBLICADO' :
                                                         result.status === 'failed'    ? 'FALLÓ' :
                                                         result.status === 'publishing' ? 'PUBLICANDO...' :
                                                         'EN COLA'}
                                                    </div>

                                                    {result.externalId && (
                                                        <p className="text-xs text-slate-500 mt-2 font-mono truncate">
                                                            ID: {result.externalId}
                                                        </p>
                                                    )}
                                                    {result.errorMsg && (
                                                        <p className="text-xs text-red-400 mt-2 leading-tight">{result.errorMsg}</p>
                                                    )}
                                                    {result.publishedAt && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {new Date(result.publishedAt).toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: HISTORIAL / LOGS                                      */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'logs' && (
                    <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="card-sanjose p-8">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-8">
                                📋 Historial de Publicaciones
                            </h2>
                            {logs.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-6xl mb-6">📭</p>
                                    <p className="text-xl font-black text-slate-400 uppercase tracking-tight">Sin historial aún</p>
                                    <p className="text-slate-500 text-sm mt-2">Las publicaciones completadas aparecerán aquí</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {logs.map(log => (
                                        <div key={log.postId} className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                                <div>
                                                    <p className="font-black text-white text-sm truncate max-w-[400px]">
                                                        {log.preview}{log.preview.length >= 80 ? '...' : ''}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {new Date(log.timestamp).toLocaleString()} · {log.postId}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500/20 text-green-300 font-bold">
                                                        ✅ {log.successCount} OK
                                                    </span>
                                                    {log.failCount > 0 && (
                                                        <span className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-bold">
                                                            ❌ {log.failCount} fail
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-400">
                                                        {log.networksCount} redes
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {log.results.map(r => {
                                                    const net = NETWORKS[r.network];
                                                    return (
                                                        <span
                                                            key={r.accountId}
                                                            title={r.errorMsg || r.externalId || r.status}
                                                            className={`text-xs px-2 py-1 rounded-lg font-bold ${
                                                                r.status === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                                            }`}
                                                        >
                                                            {net.icon} {r.status === 'success' ? '✓' : '✗'}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MODAL: CONECTAR CUENTA                                         */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showConnectModal && connectingNetwork && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) { setShowConnectModal(false); setConnectingNetwork(null); } }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-lg card-sanjose p-8"
                        >
                            {(() => {
                                const net = NETWORKS[connectingNetwork];
                                return (
                                    <>
                                        <div className="flex items-center gap-3 mb-6">
                                            <span className="text-3xl">{net.icon}</span>
                                            <div>
                                                <h3 className="text-xl font-black text-white">Conectar {net.name}</h3>
                                                <p className="text-xs text-slate-400">
                                                    {net.authType === 'token' ? 'Token directo — sin OAuth' :
                                                     net.authType === 'open_protocol' ? 'Protocolo abierto' :
                                                     'Requiere App OAuth 2.0'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                                    Nombre de la cuenta
                                                </label>
                                                <input
                                                    type="text"
                                                    value={connectForm.accountName}
                                                    onChange={e => setConnectForm(f => ({ ...f, accountName: e.target.value }))}
                                                    placeholder={`Mi ${net.name} principal`}
                                                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white
                                                               outline-none focus:border-purple-500/60 transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                                    {connectingNetwork === 'discord' ? 'Webhook URL' :
                                                     connectingNetwork === 'bluesky' ? 'usuario:contraseña_de_app' :
                                                     connectingNetwork === 'mastodon' ? 'instancia|access_token' :
                                                     'Token de Acceso'}
                                                </label>
                                                <input
                                                    type="password"
                                                    value={connectForm.token}
                                                    onChange={e => setConnectForm(f => ({ ...f, token: e.target.value }))}
                                                    placeholder={
                                                        connectingNetwork === 'telegram' ? '1234567890:ABCdefGHI...' :
                                                        connectingNetwork === 'discord' ? 'https://discord.com/api/webhooks/...' :
                                                        connectingNetwork === 'bluesky' ? 'usuario.bsky.social:mi_app_password' :
                                                        connectingNetwork === 'mastodon' ? 'mastodon.social|eyJhbGc...' :
                                                        'Token de acceso...'
                                                    }
                                                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white font-mono
                                                               outline-none focus:border-purple-500/60 transition-all"
                                                />
                                            </div>

                                            {connectingNetwork === 'telegram' && (
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                                        ID del Canal / Chat
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={connectForm.channelId}
                                                        onChange={e => setConnectForm(f => ({ ...f, channelId: e.target.value }))}
                                                        placeholder="@mi_canal o -100123456789"
                                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white
                                                                   outline-none focus:border-purple-500/60 transition-all"
                                                    />
                                                </div>
                                            )}

                                            {/* Guía rápida */}
                                            {(connectingNetwork === 'telegram' || connectingNetwork === 'discord' || connectingNetwork === 'bluesky') && (
                                                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-xs text-slate-400 leading-relaxed">
                                                    {connectingNetwork === 'telegram' && (
                                                        <><strong className="text-white">Guía:</strong> Habla con @BotFather en Telegram → /newbot → copia el token → agrega tu bot como admin al canal → copia el @username del canal</>
                                                    )}
                                                    {connectingNetwork === 'discord' && (
                                                        <><strong className="text-white">Guía:</strong> Discord → tu servidor → Configuración → Integraciones → Webhooks → Nuevo Webhook → Copiar URL</>
                                                    )}
                                                    {connectingNetwork === 'bluesky' && (
                                                        <><strong className="text-white">Guía:</strong> Bluesky → Settings → App Passwords → Add App Password → Copia y pega como "tuusuario.bsky.social:la_contraseña_de_app"</>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-3 mt-6">
                                            <button
                                                onClick={() => { setShowConnectModal(false); setConnectingNetwork(null); setConnectForm({ accountName: '', token: '', channelId: '' }); }}
                                                className="flex-1 py-3 rounded-xl border border-slate-700/50 text-slate-400 font-bold text-sm hover:bg-slate-800/50 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleConnect}
                                                disabled={!connectForm.accountName || !connectForm.token || connecting}
                                                className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider
                                                           bg-gradient-to-r from-purple-600 to-pink-600 text-white
                                                           hover:from-purple-500 hover:to-pink-500 transition-all
                                                           disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {connecting ? <><span className="animate-spin">⟳</span> Conectando...</> : '🔗 Conectar'}
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
