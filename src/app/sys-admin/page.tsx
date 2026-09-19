"use client";

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Database, DollarSign, Store, Lock, Key, Plus, RefreshCw, CheckCircle, XCircle, Copy, Trash2, LogIn, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface License {
    key: string;
    clientName: string;
    email: string;
    isActive: boolean;
    machineIds: string[];
    maxMachines: number;
    createdAt: number;
    expiresAt: number | null;
}

export default function SysAdmin() {
    // ── Auth State ─────────────────────────────────────────────────────────
    // La autenticación se verifica contra el servidor (cookie de sesión).
    // El panel solo se muestra si el usuario tiene rol 'superadmin' válido.
    const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
    const [loginPin, setLoginPin] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const [tab, setTab] = useState<'main' | 'licenses'>('main');

    // License management state
    const [licenses, setLicenses]     = useState<License[]>([]);
    const [licLoading, setLicLoading] = useState(false);
    const [newForm, setNewForm]       = useState({ clientName: '', email: '', maxMachines: 1 });
    const [newKey, setNewKey]         = useState<string | null>(null);
    const [msg, setMsg]               = useState('');

    // ── Verify session on mount ─────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/users/me')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.user?.role === 'superadmin') {
                    setAuthState('authenticated');
                } else {
                    setAuthState('unauthenticated');
                }
            })
            .catch(() => setAuthState('unauthenticated'));
    }, []);

    // ── Login via PIN contra la DB local ────────────────────────────────────
    const handleLogin = async () => {
        if (!loginPin.trim()) return;
        setLoginLoading(true);
        setLoginError('');
        try {
            const res = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: loginPin }),
            });
            const data = await res.json();
            if (data.success && data.role === 'superadmin') {
                setAuthState('authenticated');
            } else if (data.success && data.role !== 'superadmin') {
                setLoginError('Acceso denegado: se requiere rol superadmin.');
            } else {
                setLoginError(data.error || 'PIN incorrecto.');
            }
        } catch {
            setLoginError('Error de conexión. Verifica que el servidor esté corriendo.');
        } finally {
            setLoginLoading(false);
        }
    };

    // ── License API calls (usan cookies de sesión automáticamente) ──────────
    const fetchLicenses = useCallback(async () => {
        setLicLoading(true);
        try {
            const res = await fetch('/api/licenses');
            if (res.status === 401 || res.status === 403) {
                setAuthState('unauthenticated');
                return;
            }
            const data = await res.json();
            setLicenses(data.licenses ?? []);
        } catch { setMsg('Error cargando licencias'); }
        finally { setLicLoading(false); }
    }, []);

    useEffect(() => {
        if (authState === 'authenticated' && tab === 'licenses') fetchLicenses();
    }, [authState, tab, fetchLicenses]);

    const createLicense = async () => {
        if (!newForm.clientName || !newForm.email) { setMsg('Rellena todos los campos'); return; }
        setLicLoading(true);
        try {
            const res = await fetch('/api/licenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newForm),
            });
            const data = await res.json();
            if (data.success) {
                setNewKey(data.key);
                setMsg(`✅ Licencia creada para ${data.clientName}`);
                setNewForm({ clientName: '', email: '', maxMachines: 1 });
                fetchLicenses();
            } else {
                setMsg(`❌ ${data.error}`);
            }
        } catch { setMsg('Error creando licencia'); }
        finally { setLicLoading(false); }
    };

    const toggleLicense = async (key: string, isActive: boolean) => {
        try {
            await fetch('/api/licenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, isActive: !isActive }),
            });
            fetchLicenses();
        } catch { setMsg('Error actualizando licencia'); }
    };

    const resetMachines = async (key: string) => {
        try {
            await fetch('/api/licenses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, resetMachines: true }),
            });
            fetchLicenses();
            setMsg(`✅ Máquinas reseteadas para ${key}`);
        } catch { setMsg('Error'); }
    };

    // ── Respaldo de Base de Datos ──────────────────────────────────────────
    const handleDownloadBackup = async () => {
        try {
            const res = await fetch('/api/backup');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `camaleon_backup_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                toast.error('Error al generar el respaldo.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión.');
        }
    };

    const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                
                if (confirm('⚠️ ADVERTENCIA: Esto sobreescribirá toda la base de datos actual. ¿Deseas continuar?')) {
                    setLicLoading(true);
                    const res = await fetch('/api/backup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    if (res.ok) {
                        toast.success('¡Base de datos restaurada correctamente!', '✅ Restauración');
                    } else {
                        const err = await res.json();
                        toast.error(`Error al restaurar: ${err.error}`);
                    }
                    setLicLoading(false);
                }
            } catch (err) {
                toast.error('Archivo inválido o corrupto.');
            }
        };
        reader.readAsText(file);
    };

    // ── Loading screen ──────────────────────────────────────────────────────
    if (authState === 'loading') {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', color: '#0f0', fontFamily: 'monospace' }}>
                <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginLeft: '1rem' }}>Verificando sesión...</p>
            </div>
        );
    }

    // ── Login screen ────────────────────────────────────────────────────────
    if (authState === 'unauthenticated') {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', color: '#0f0', fontFamily: 'monospace' }}>
                <div style={{ textAlign: 'center' }}>
                    <ShieldAlert size={64} style={{ marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>ADMIN.COM ERP</h1>
                    <p style={{ color: '#555', marginBottom: '2rem', fontSize: '0.8rem' }}>PANEL DE CONTROL — REQUIERE SUPERADMIN</p>
                    <input
                        type="password"
                        value={loginPin}
                        onChange={(e) => setLoginPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !loginLoading && handleLogin()}
                        placeholder="PIN SUPERADMIN"
                        style={{ background: 'black', border: '1px solid #0f0', color: '#0f0', padding: '12px 20px', width: '300px', textAlign: 'center', outline: 'none', fontSize: '1rem' }}
                    />
                    {loginError && (
                        <p style={{ color: '#E30613', fontSize: '0.8rem', marginTop: '8px' }}>{loginError}</p>
                    )}
                    <br />
                    <button
                        onClick={handleLogin}
                        disabled={loginLoading}
                        style={{ marginTop: '1rem', background: loginLoading ? '#555' : '#0f0', color: 'black', border: 'none', padding: '12px 30px', fontWeight: 'bold', cursor: loginLoading ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        {loginLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={18} />}
                        {loginLoading ? 'VERIFICANDO...' : 'ACCEDER'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Authenticated panel ─────────────────────────────────────────────────
    return (
        <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', borderBottom: '2px solid #E30613', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ color: '#E30613', fontWeight: '900', fontSize: '2rem' }}>PANEL MAESTRO — ADMIN.COM</h1>
                        <p style={{ color: '#666', marginTop: '4px' }}>Zona de Desarrollo y Configuración</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {(['main', 'licenses'] as const).map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                style={{ padding: '8px 20px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', border: 'none',
                                    background: tab === t ? '#E30613' : '#ddd', color: tab === t ? 'white' : '#333' }}>
                                {t === 'main' ? '🏠 SISTEMA' : '🔑 LICENCIAS'}
                            </button>
                        ))}
                    </div>
                </header>

                {/* ── TAB: MAIN ── */}
                {tab === 'main' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div className="card-sanjose" style={{ borderLeft: '5px solid #27ae60' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <DollarSign size={24} color="#27ae60" />
                                <h3 style={{ fontWeight: 'bold' }}>Suscripción &amp; Licencia</h3>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>Controla el estado de pago. Activa o desactiva el sistema remotamente.</p>
                            <button onClick={() => setTab('licenses')} className="btn-sanjose-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>GESTIONAR LICENCIAS</button>
                        </div>
                        <div className="card-sanjose" style={{ borderLeft: '5px solid #0ea5e9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Store size={24} color="#0ea5e9" />
                                <h3 style={{ fontWeight: 'bold' }}>Multi-Sucursal</h3>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>Despliega nuevas instancias para sucursales adicionales.</p>
                            <button className="btn-sanjose" style={{ width: '100%', fontSize: '0.85rem' }}>+ AGREGAR NUEVA TIENDA</button>
                        </div>
                        <div className="card-sanjose" style={{ borderLeft: '5px solid #8e44ad' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Database size={24} color="#8e44ad" />
                                <h3 style={{ fontWeight: 'bold' }}>Base de Datos Local (SQLite)</h3>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                                Todo el sistema reside localmente. Puedes descargar la base completa o restaurarla.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleDownloadBackup} className="btn-sanjose" style={{ width: '100%', fontSize: '0.85rem' }}>DESCARGAR (JSON)</button>
                                <label className="btn-sanjose-secondary" style={{ width: '100%', fontSize: '0.85rem', textAlign: 'center', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestoreBackup} />
                                    RESTAURAR
                                </label>
                            </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', background: '#333', color: 'white', borderRadius: '8px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Lock size={20} /> NOTAS DEL DESARROLLADOR
                            </h3>
                            <ul style={{ fontSize: '0.9rem', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
                                <li>Para crear una licencia nueva → pestaña <strong>LICENCIAS</strong>.</li>
                                <li>Cada licencia genera una clave <code>ADMIN-XXXX-XXXX-XXXX</code> única.</li>
                                <li>Una licencia = 1 PC (1 machineId). Puedes aumentar <code>maxMachines</code>.</li>
                                <li>Si el cliente cambia de PC → usa <strong>&ldquo;Reset Máquinas&rdquo;</strong>.</li>
                                <li>Para desactivar acceso inmediato → toggle <strong>Activa/Inactiva</strong>.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ── TAB: LICENCIAS ── */}
                {tab === 'licenses' && (
                    <div>
                        {/* Create form */}
                        <div className="card-sanjose" style={{ marginBottom: '2rem', borderLeft: '5px solid #27ae60' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontWeight: '900' }}>
                                <Plus size={20} color="#27ae60" /> CREAR NUEVA LICENCIA
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '12px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#666', display: 'block', marginBottom: '4px' }}>CLIENTE</label>
                                    <input value={newForm.clientName} onChange={e => setNewForm(p => ({ ...p, clientName: e.target.value }))}
                                        placeholder="Ferretería López" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#666', display: 'block', marginBottom: '4px' }}>EMAIL</label>
                                    <input value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="cliente@email.com" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#666', display: 'block', marginBottom: '4px' }}>MAX PCs</label>
                                    <input type="number" min={1} max={10} value={newForm.maxMachines} onChange={e => setNewForm(p => ({ ...p, maxMachines: +e.target.value }))}
                                        style={{ width: '80px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', outline: 'none', textAlign: 'center' }} />
                                </div>
                                <button onClick={createLicense} disabled={licLoading}
                                    style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {licLoading ? '...' : '+ GENERAR'}
                                </button>
                            </div>

                            {msg && <p style={{ marginTop: '12px', fontSize: '0.85rem', color: msg.startsWith('✅') ? '#27ae60' : '#E30613' }}>{msg}</p>}

                            {newKey && (
                                <div style={{ marginTop: '16px', background: '#000', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ color: '#888', fontSize: '0.7rem', margin: '0 0 4px 0' }}>CLAVE GENERADA — ENVIAR AL CLIENTE</p>
                                        <code style={{ color: '#00C853', fontSize: '1.2rem', fontWeight: '700', letterSpacing: '2px' }}>{newKey}</code>
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(newKey); setMsg('✅ Copiado al portapapeles'); }}
                                        style={{ background: '#333', border: 'none', color: '#00C853', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}>
                                        <Copy size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Licenses list */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontWeight: '900', color: '#333' }}>LICENCIAS ACTIVAS ({licenses.length})</h3>
                            <button onClick={fetchLicenses} style={{ background: 'none', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                <RefreshCw size={14} /> Actualizar
                            </button>
                        </div>

                        {licenses.length === 0 && !licLoading && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                                <Key size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                <p>No hay licencias registradas aún.</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {licenses.map(lic => (
                                <div key={lic.key} className="card-sanjose" style={{ padding: '1rem 1.5rem', borderLeft: `5px solid ${lic.isActive ? '#27ae60' : '#E30613'}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                            {lic.isActive ? <CheckCircle size={16} color="#27ae60" /> : <XCircle size={16} color="#E30613" />}
                                            <strong style={{ fontSize: '1rem' }}>{lic.clientName}</strong>
                                            <span style={{ fontSize: '0.75rem', color: '#888' }}>{lic.email}</span>
                                        </div>
                                        <code style={{ fontSize: '0.9rem', color: '#0ea5e9', letterSpacing: '1px' }}>{lic.key}</code>
                                        <span style={{ marginLeft: '16px', fontSize: '0.75rem', color: '#888' }}>
                                            {lic.machineIds.length}/{lic.maxMachines} PC{lic.maxMachines > 1 ? 's' : ''} · Creada: {new Date(lic.createdAt).toLocaleDateString('es-MX')}
                                            {lic.expiresAt ? ` · Vence: ${new Date(lic.expiresAt).toLocaleDateString('es-MX')}` : ' · Permanente'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => { navigator.clipboard.writeText(lic.key); }}
                                            title="Copiar clave" style={{ background: '#f0f4f8', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                                            <Copy size={14} color="#666" />
                                        </button>
                                        <button onClick={() => resetMachines(lic.key)}
                                            title="Reset máquinas" style={{ background: '#FFF3CD', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                                            <Trash2 size={14} color="#856404" />
                                        </button>
                                        <button onClick={() => toggleLicense(lic.key, lic.isActive)}
                                            style={{ background: lic.isActive ? '#FFE5E5' : '#E8F5E9', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', color: lic.isActive ? '#E30613' : '#27ae60' }}>
                                            {lic.isActive ? 'DESACTIVAR' : 'ACTIVAR'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
