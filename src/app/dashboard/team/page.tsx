"use client";

import { useState, useEffect } from 'react';
import { ShieldCheck, UserPlus, Save, Edit2, Trash2, Copy, CheckCircle, RefreshCw, Users, Mail, Key, Crown, Zap, Package, TrendingUp, Truck, Megaphone, Circle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    role: string;
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    code: string;
    status: 'pending' | 'used';
    createdAt: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string; icon: React.ReactNode }> = {
    superadmin: { bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20', icon: <Crown size={12} /> },
    admin:      { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', glow: 'shadow-purple-500/20', icon: <ShieldCheck size={12} /> },
    inventory:  { bg: 'bg-sky-500/10',    text: 'text-sky-300',    border: 'border-sky-500/30',    glow: 'shadow-sky-500/20',    icon: <Package size={12} /> },
    sales:      { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-500/30',glow: 'shadow-emerald-500/20',icon: <TrendingUp size={12} /> },
    delivery:   { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30', glow: 'shadow-orange-500/20', icon: <Truck size={12} /> },
    marketing:  { bg: 'bg-pink-500/10',   text: 'text-pink-300',   border: 'border-pink-500/30',   glow: 'shadow-pink-500/20',   icon: <Megaphone size={12} /> },
    node:       { bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   border: 'border-cyan-500/30',   glow: 'shadow-cyan-500/20',   icon: <Zap size={12} /> },
};

function RoleBadge({ role, label }: { role: string; label: string }) {
    const cfg = ROLE_COLORS[role] ?? { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30', glow: '', icon: <Circle size={12} /> };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.glow}`}>
            {cfg.icon}{label}
        </span>
    );
}

export default function TeamManagement() {
    const { isSuperAdmin, isReadOnly, profile } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('node');
    const [sendingInvite, setSendingInvite] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const roles = [
        { id: 'admin',     label: 'Admin (Acceso Total)' },
        { id: 'inventory', label: 'Gestor de Inventario' },
        { id: 'sales',     label: 'Representante de Ventas' },
        { id: 'delivery',  label: 'Repartidor / Chofer' },
        { id: 'marketing', label: 'Especialista Marketing' },
        { id: 'node',      label: 'Nodo Básico' }
    ];

    const DEMO_INVITATIONS: Invitation[] = [
        { id: 'INV-1', email: 'soporte@empresa.com', role: 'admin', code: 'INV-XYZ123', status: 'pending', createdAt: new Date().toISOString() },
        { id: 'INV-2', email: 'ventas2@empresa.com', role: 'sales', code: 'INV-ABC987', status: 'pending', createdAt: new Date().toISOString() }
    ];

    const fetchData = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData: UserData[] = [];
            querySnapshot.forEach((doc: any) => { usersData.push({ uid: doc.id, ...doc.data() } as UserData); });
            setUsers(usersData);
            try {
                const inviteSnapshot = await getDocs(collection(db, 'invitations'));
                const invitesData: Invitation[] = [];
                inviteSnapshot.forEach((doc: any) => { invitesData.push({ id: doc.id, ...doc.data() } as Invitation); });
                setInvitations(invitesData);
            } catch { setInvitations(DEMO_INVITATIONS); }
        } catch { setInvitations(DEMO_INVITATIONS); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSaveRole = async (userId: string) => {
        if (!selectedRole || !isSuperAdmin) return;
        if (isReadOnly) { alert('🔒 Modo Demo: No se pueden guardar cambios.'); setEditingUserId(null); return; }
        const existingCount = users.filter(u => u.role === selectedRole).length;
        if (existingCount >= 5) { alert(`⚠️ Límite alcanzado: Ya existen ${existingCount} usuarios con este rol.`); setEditingUserId(null); return; }
        try {
            await updateDoc(doc(db, 'users', userId), { role: selectedRole });
            setUsers(users.map(u => u.uid === userId ? { ...u, role: selectedRole } : u));
            setEditingUserId(null);
        } catch { alert('Error al actualizar el rol'); }
    };

    const handleDeleteInvite = async (id: string) => {
        if (isReadOnly) { alert('🔒 Modo Demo: Operación no permitida.'); return; }
        if (!confirm('¿Cancelar esta invitación?')) return;
        try { await deleteDoc(doc(db, 'invitations', id)); } catch {}
        setInvitations(invitations.filter(i => i.id !== id));
    };

    const handleCopyLink = (code: string, id: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/login?invite=${code}`);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
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
                            <p className="text-gray-400 text-sm font-medium mt-1">Asigna permisos, controla el acceso e invita colaboradores.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/80/5 border border-white/10 px-4 py-2 rounded-xl text-sm text-gray-300">
                        <Users size={16} className="text-sky-400" />
                        <span><b className="text-white">{users.length}</b> miembros activos</span>
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
                            {roles.map(role => {
                                const roleUsers = users.filter(u => u.role === role.id);
                                return (
                                    <div key={role.id} className="mb-6">
                                        <h3 className="font-bold text-white text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-sky-400"></div>
                                            {role.label} <span className="text-gray-500">({roleUsers.length}/{role.id === 'admin' ? 1 : 5})</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            {Array.from({ length: role.id === 'admin' ? 1 : 5 }).map((_, idx) => {
                                                const user = roleUsers[idx];
                                                if (user) {
                                                    return (
                                                        <div key={user.uid} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col justify-between">
                                                            <div>
                                                                <div className="font-bold text-white text-sm truncate" title={user.displayName || 'Sin Nombre'}>{user.displayName || 'Sin Nombre'}</div>
                                                                <div className="text-[10px] text-gray-500 mt-1 truncate" title={user.email}>{user.email}</div>
                                                            </div>
                                                            {isSuperAdmin && (
                                                                <button
                                                                    onClick={() => { setEditingUserId(user.uid); setSelectedRole(user.role); }}
                                                                    className="mt-4 text-center w-full bg-slate-900/50 hover:bg-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors border border-sky-500/10"
                                                                >
                                                                    Editar Rol
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div key={`empty-${role.id}-${idx}`} className="border border-dashed border-slate-700/50 bg-slate-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[100px] transition-colors hover:border-sky-500/30 hover:bg-sky-500/5">
                                                            <div className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">Disponible</div>
                                                            {isSuperAdmin && (
                                                                <button 
                                                                    onClick={() => setInviteRole(role.id)}
                                                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors"
                                                                >
                                                                    Asignar
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                            })}
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
                                        <h3 className="font-black text-white uppercase tracking-tight">Alta Rápida</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Demo</p>
                                    </div>
                                </div>

                                <div className="bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs font-medium p-3 rounded-xl mb-5 leading-relaxed">
                                    El usuario recibirá la contraseña genérica <strong>"0000"</strong> y se le pedirá cambiarla al ingresar.
                                </div>

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!inviteEmail || !inviteName || !inviteRole || isReadOnly) return;
                                    const existingCount = users.filter(u => u.role === inviteRole).length;
                                    const maxAllowed = inviteRole === 'admin' ? 1 : 5;
                                    if (existingCount >= maxAllowed) { alert(`⚠️ Límite: Ya se alcanzó el máximo permitido de ${maxAllowed} para este rol.`); return; }
                                    setSendingInvite(true);
                                    try {
                                        const newUid = `user-${Date.now()}`;
                                        await setDoc(doc(db, 'users', newUid), {
                                            email: inviteEmail, role: inviteRole,
                                            tenantId: profile?.tenantId || 'demo-tenant',
                                            displayName: inviteName,
                                            password: '0000', needsSetup: true,
                                            createdAt: serverTimestamp()
                                        });
                                        setUsers([...users, { uid: newUid, email: inviteEmail, role: inviteRole, displayName: inviteName }]);
                                        alert('Usuario creado. Contraseña: "0000"');
                                        setInviteEmail('');
                                        setInviteName('');
                                    } catch (err: any) { alert('Error al crear usuario: ' + err.message); console.error(err); }
                                    finally { setSendingInvite(false); }
                                }} className="space-y-4">

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <UserPlus size={10} className="inline mr-1" /> Nombre Completo
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Juan Pérez"
                                            required
                                            value={inviteName}
                                            onChange={e => setInviteName(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white placeholder-gray-600 font-medium text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all mb-4"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <Mail size={10} className="inline mr-1" /> Email de Invitación
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="colaborador@correo.com"
                                            required
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white placeholder-gray-600 font-medium text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                            <Key size={10} className="inline mr-1" /> Rol Asignado
                                        </label>
                                        <select
                                            value={inviteRole}
                                            onChange={e => setInviteRole(e.target.value)}
                                            className="w-full bg-[#0f111a] border border-white/10 text-white font-bold text-sm px-4 py-3 rounded-xl outline-none focus:border-[#0ea5e9] transition-all appearance-none"
                                        >
                                            {roles.map(r => <option key={r.id} value={r.id} className="bg-[#1a1d2d] text-white">{r.label}</option>)}
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={sendingInvite}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase text-xs tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {sendingInvite ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                        {sendingInvite ? 'Generando...' : 'Crear Usuario'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Invitaciones pendientes */}
                        <div className="bg-[#1a1d2d] border border-white/5 rounded-[28px] p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-emerald-500/15 text-emerald-300 p-2.5 rounded-xl border border-emerald-500/20">
                                    <Mail size={18} />
                                </div>
                                <h3 className="font-black text-white uppercase tracking-tight">Invitaciones Pendientes</h3>
                            </div>

                            <div className="space-y-3">
                                {invitations.map(invite => {
                                    const roleLabel = roles.find(r => r.id === invite.role)?.label || invite.role;
                                    return (
                                        <div key={invite.id} className="bg-black/20 border border-white/5 rounded-2xl p-4 relative group">
                                            <div className="font-bold text-white text-sm truncate pr-8">{invite.email}</div>
                                            <div className="mt-1.5 flex items-center gap-2">
                                                <RoleBadge role={invite.role} label={roleLabel} />
                                            </div>
                                            <div className="text-[10px] text-gray-600 font-mono mt-2">🔑 {invite.code}</div>
                                            <div className="flex items-center gap-2 mt-3">
                                                <button
                                                    onClick={() => handleCopyLink(invite.code, invite.id)}
                                                    className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                >
                                                    {copiedId === invite.id ? <CheckCircle size={11} /> : <Copy size={11} />}
                                                    {copiedId === invite.id ? 'Copiado' : 'Copiar Link'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteInvite(invite.id)}
                                                    className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                >
                                                    <Trash2 size={11} /> Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {invitations.length === 0 && (
                                    <div className="text-center text-gray-600 text-sm py-8">No hay invitaciones activas.</div>
                                )}
                            </div>
                        </div>

                        {/* Leyenda de Roles */}
                        <div className="bg-[#1a1d2d] border border-white/5 rounded-[28px] p-6 shadow-xl">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-4">Paleta de Roles</h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(ROLE_COLORS).map(([roleId, cfg]) => {
                                    const lbl = roles.find(r => r.id === roleId)?.label || roleId;
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
        </div>
    );
}
