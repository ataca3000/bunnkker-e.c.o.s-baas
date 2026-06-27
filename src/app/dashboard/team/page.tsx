"use client";

import { useState, useEffect } from 'react';
import { ShieldCheck, UserPlus, Trash2, RefreshCw, Users, Key, Crown, Zap, Package, TrendingUp, Truck, Megaphone, Circle, QrCode, X, Copy, Smartphone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import QRCode from 'react-qr-code';

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string; icon: React.ReactNode }> = {
    superadmin: { bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20', icon: <Crown size={12} /> },
    admin:      { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', glow: 'shadow-purple-500/20', icon: <ShieldCheck size={12} /> },
    inventory:  { bg: 'bg-sky-500/10',    text: 'text-sky-300',    border: 'border-sky-500/30',    glow: 'shadow-sky-500/20',    icon: <Package size={12} /> },
    sales:      { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/30',glow: 'shadow-emerald-500/20',icon: <TrendingUp size={12} /> },
    delivery:   { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30', glow: 'shadow-orange-500/20', icon: <Truck size={12} /> },
    marketing:  { bg: 'bg-pink-500/10',   text: 'text-pink-300',   border: 'border-pink-500/30',   glow: 'shadow-pink-500/20',   icon: <Megaphone size={12} /> },
};

export default function TeamManagement() {
    const { isSuperAdmin, isReadOnly } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [qrUser, setQrUser] = useState<UserData | null>(null);
    const [magicUrl, setMagicUrl] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [newName, setNewName] = useState('');
    const [newPin, setNewPin] = useState('');
    const [newRole, setNewRole] = useState('sales');
    const [sending, setSending] = useState(false);

    const roles = [
        { id: 'inventory', label: 'Gestor de Inventario' },
        { id: 'sales',     label: 'Caja / Ventas' },
        { id: 'delivery',  label: 'Repartidor / Chofer' },
        { id: 'marketing', label: 'Especialista Marketing' }
    ];

    const fetchData = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSaveRole = async (userId: string) => {
        if (!selectedRole || !isSuperAdmin) return;
        if (isReadOnly) { alert('🔒 Modo Demo: No se pueden guardar cambios.'); setEditingUserId(null); return; }
        
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: selectedRole })
            });
            const data = await res.json();
            if (data.success) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: selectedRole } : u));
                setEditingUserId(null);
            } else {
                alert(data.error);
            }
        } catch { alert('Error al actualizar el rol'); }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!isSuperAdmin) return;
        if (isReadOnly) { alert('🔒 Modo Demo: Operación no permitida.'); return; }
        if (!confirm('¿Eliminar este usuario definitivamente?')) return;
        try {
            const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== userId));
            }
        } catch { alert('Error al borrar usuario'); }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newPin || !newRole || isReadOnly) return;
        if (newPin.length < 4) { alert('El PIN debe tener al menos 4 dígitos'); return; }

        setSending(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, pin: newPin, role: newRole })
            });
            const data = await res.json();
            if (data.success) {
                setUsers([...users, data.data]);
                setNewName('');
                setNewPin('');
                alert('Usuario creado exitosamente.');
            } else {
                alert('Error al crear usuario: ' + data.error);
            }
        } catch (err: any) { 
            alert('Error de conexión');
        } finally { 
            setSending(false); 
        }
    };

    const handleOpenQr = async (user: UserData) => {
        setQrUser(user);
        setMagicUrl(''); // Reset
        try {
            const res = await fetch(`/api/users/${user.id}/magic`);
            const data = await res.json();
            
            const ipRes = await fetch('/api/network-ip');
            const ipData = await ipRes.json();
            
            if (data.success && typeof window !== 'undefined') {
                const protocol = window.location.protocol;
                const port = window.location.port ? `:${window.location.port}` : '';
                const host = ipData.success ? `${protocol}//${ipData.ip}${port}` : window.location.origin;
                
                setMagicUrl(`${host}/api/auth/magic?token=${data.payload}`);
            } else {
                alert('No se pudo generar la llave mágica.');
                setQrUser(null);
            }
        } catch {
            alert('Error de conexión al generar la llave.');
            setQrUser(null);
        }
    };

    const handleResetDevice = async (userId: string) => {
        if (!confirm('¿Seguro que deseas desvincular el dispositivo de este usuario? Tendrá que volver a iniciar sesión en su teléfono.')) return;
        
        try {
            const res = await fetch(`/api/users/${userId}/reset-device`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Dispositivo desvinculado con éxito.');
            } else {
                alert('Error al desvincular: ' + data.error);
            }
        } catch (err: any) {
            alert('Error de conexión');
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">
            <RefreshCw className="animate-spin text-[#0ea5e9]" size={40} />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0f111a] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10">
                    <div className="flex items-center gap-5">
                        <div className="bg-purple-500/20 border border-purple-500/30 p-4 rounded-2xl text-purple-300 shadow-lg shadow-purple-500/10">
                            <ShieldCheck size={36} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-[950] text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-sky-300 to-emerald-300 uppercase tracking-tight">
                                Equipo y Roles
                            </h1>
                            <p className="text-gray-400 text-sm font-medium mt-1">Gestión de empleados local (SQLite).</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/80/5 border border-white/10 px-4 py-2 rounded-xl text-sm text-gray-300">
                        <Users size={16} className="text-sky-400" />
                        <span><b className="text-white">{users.length}</b> miembros</span>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

                    {/* --- TABLA DE MIEMBROS --- */}
                    <div className="bg-[#1a1d2d] border border-white/5 rounded-[28px] overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                            <div className="bg-sky-500/20 text-sky-300 p-2 rounded-lg">
                                <Users size={18} />
                            </div>
                            <h2 className="font-black text-white uppercase tracking-tight text-lg">Miembros Activos</h2>
                        </div>
                        <div className="p-6 space-y-8 h-[700px] overflow-y-auto hide-scrollbar">
                            {['superadmin', ...roles.map(r => r.id)].map(roleId => {
                                const roleUsers = users.filter(u => u.role === roleId);
                                if (roleUsers.length === 0) return null;
                                
                                const roleLabel = roleId === 'superadmin' ? 'Superadmin (Dueño)' : roles.find(r => r.id === roleId)?.label;

                                return (
                                    <div key={roleId} className="mb-6">
                                        <h3 className="font-bold text-white text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-sky-400"></div>
                                            {roleLabel} <span className="text-gray-500">({roleUsers.length})</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {roleUsers.map((user) => (
                                                <div key={user.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col justify-between">
                                                    <div>
                                                        <div className="font-bold text-white text-sm truncate" title={user.name}>{user.name}</div>
                                                        <div className="text-[10px] text-gray-500 mt-1 truncate">ID: {user.id.substring(0,8)}...</div>
                                                    </div>
                                                    {isSuperAdmin && user.role !== 'superadmin' && (
                                                        <div className="mt-4 flex gap-2">
                                                            {editingUserId === user.id ? (
                                                                <div className="flex w-full gap-1">
                                                                    <select 
                                                                        value={selectedRole} 
                                                                        onChange={(e) => setSelectedRole(e.target.value)}
                                                                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded"
                                                                    >
                                                                        {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                                                    </select>
                                                                    <button onClick={() => handleSaveRole(user.id)} className="bg-emerald-500/20 text-emerald-400 px-2 rounded font-bold text-xs">OK</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleOpenQr(user)}
                                                                        className="flex-1 text-center bg-slate-900/50 hover:bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors border border-purple-500/10 flex items-center justify-center gap-1"
                                                                    >
                                                                        <QrCode size={12} /> Llave
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEditingUserId(user.id); setSelectedRole(user.role); }}
                                                                        className="flex-1 text-center bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors border border-sky-500/10"
                                                                    >
                                                                        Rol
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleResetDevice(user.id)}
                                                                        className="flex-1 text-center bg-slate-900/50 hover:bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors border border-orange-500/10 flex items-center justify-center"
                                                                        title="Desvincular Dispositivo"
                                                                    >
                                                                        <Smartphone size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(user.id)}
                                                                        className="bg-slate-900/50 hover:bg-red-500/20 text-red-400 text-[10px] px-2 rounded-lg transition-colors border border-red-500/10"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- COLUMNA DERECHA --- */}
                    <div className="flex flex-col gap-6">

                        {/* Alta Rápida */}
                        {isSuperAdmin && (
                            <div className="bg-[#1a1d2d] border border-yellow-500/20 rounded-[28px] p-6 shadow-xl shadow-yellow-500/5 relative overflow-hidden">
                                <div className="absolute -top-16 -right-16 w-40 h-40 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="bg-yellow-500/15 text-yellow-300 p-2.5 rounded-xl border border-yellow-500/20">
                                        <UserPlus size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white uppercase tracking-tight">Nuevo Empleado</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Base Local SQLite</p>
                                    </div>
                                </div>

                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <UserPlus size={10} className="inline mr-1" /> Nombre Completo
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej. Juan Pérez"
                                            required
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white placeholder-gray-600 font-medium text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all mb-4"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <Key size={10} className="inline mr-1" /> PIN de Acceso (4+ dígitos)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="1234"
                                            required
                                            value={newPin}
                                            onChange={e => setNewPin(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white placeholder-gray-600 font-medium text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <ShieldCheck size={10} className="inline mr-1" /> Rol Asignado
                                        </label>
                                        <select
                                            value={newRole}
                                            onChange={e => setNewRole(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white font-bold text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all appearance-none"
                                        >
                                            {roles.map(r => <option key={r.id} value={r.id} className="bg-[#1a1d2d] text-white">{r.label}</option>)}
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase text-xs tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95 disabled:opacity-50 mt-4"
                                    >
                                        {sending ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                        {sending ? 'Creando...' : 'Guardar Empleado'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Leyenda de Roles */}
                        <div className="bg-[#1a1d2d] border border-white/5 rounded-[28px] p-6 shadow-xl">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-4">Paleta de Roles</h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(ROLE_COLORS).map(([roleId, cfg]) => {
                                    const lbl = roles.find(r => r.id === roleId)?.label || (roleId === 'superadmin' ? 'Superadmin' : roleId);
                                    return (
                                        <span key={roleId} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                            {cfg.icon} {lbl}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Llave QR Mágica */}
            {qrUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center">
                        <button 
                            onClick={() => setQrUser(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full"
                        >
                            <X size={20} />
                        </button>
                        <div className="bg-purple-500/20 text-purple-400 p-3 rounded-2xl mb-4">
                            <Key size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-white text-center mb-1">Llave de Acceso</h2>
                        <p className="text-slate-400 text-sm text-center mb-6">Para: <b>{qrUser.name}</b></p>
                        
                        <div className="bg-white p-4 rounded-2xl mb-6 min-h-[232px] flex items-center justify-center">
                            {magicUrl ? (
                                <QRCode 
                                    value={magicUrl} 
                                    size={200}
                                />
                            ) : (
                                <RefreshCw className="animate-spin text-slate-300" size={32} />
                            )}
                        </div>

                        <p className="text-xs text-slate-500 text-center mb-6 px-4">
                            Pide a {qrUser.name.split(' ')[0]} que escanee este código con su celular para iniciar sesión automáticamente.
                        </p>

                        <button 
                            disabled={!magicUrl}
                            onClick={() => {
                                navigator.clipboard.writeText(magicUrl);
                                alert('¡Enlace copiado al portapapeles!');
                            }}
                            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-600 transition-colors"
                        >
                            <Copy size={16} />
                            Copiar Enlace Directo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
