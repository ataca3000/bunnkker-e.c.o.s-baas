"use client";

import { useState, useEffect } from 'react';
import { Camera, Save, User, MapPin, Mail, Phone, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/lib/toast';

export default function UserProfile() {
    const { profile, isReadOnly } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [userData, setUserData] = useState({
        name: 'Usuario ERP',
        role: 'Colaborador',
        email: 'usuario@sistema.com',
        phone: '',
        address: 'No registrada',
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200',
        pin: ''
    });

    useEffect(() => {
        if (profile) {
            setUserData({
                name: profile.displayName || 'Administrador',
                role: profile.role === 'superadmin' ? 'Super Administrador' : (profile.role === 'admin' ? 'Administrador' : 'Colaborador'),
                email: profile.email || 'admin@sistema.com',
                phone: profile.recoveryPhone || '',
                address: profile.recoveryEmail || 'No registrada',
                photo: (profile as any).photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200',
                pin: (profile as any).pin || ''
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (isReadOnly) {
            toast.warning('No se pueden guardar cambios en Modo Demo.', '🔒 Demo');
            setIsEditing(false);
            return;
        }

        try {
            // Actualizar PIN localmente via /api/users/me
            if (userData.pin && userData.pin.length >= 4 && userData.pin.length <= 6) {
                const res = await fetch('/api/users/me', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'CHANGE_PIN',
                        newPin: userData.pin
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    toast.error(data.error || 'Error al actualizar el PIN en el perfil.');
                    return;
                }
            }

            toast.success('Perfil y PIN actualizados correctamente en SQLite.', '✅ Perfil');
        } catch (err: unknown) {
            console.error("Error saving profile:", err);
            toast.error('Error interno al actualizar el perfil.');
        } finally {
            setIsEditing(false);
        }
    };

    return (
        <div className="relative min-h-[100dvh] bg-slate-950 text-white p-4 md:p-8">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/40 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/30 blur-[120px] rounded-full"></div>
            </div>
            
            <div className="relative z-10 max-w-4xl mx-auto">
                <h1 className="text-3xl font-black text-white mb-8 drop-shadow-[0_0_8px_rgba(0,242,255,0.8)] tracking-tight">MI PERFIL</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

                    {/* Foto de Perfil */}
                    <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 shadow-[0_0_20px_rgba(0,242,255,0.1)] rounded-sm p-6 text-center">
                        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-cyan-500 shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                            <img src={userData.photo} alt="Perfil" className="w-full h-full object-cover" />
                            {isEditing && (
                                <div className="absolute bottom-0 left-0 w-full bg-slate-900/80 text-cyan-300 p-1 text-xs cursor-pointer flex justify-center items-center gap-1">
                                    <Camera size={14} /> Cambiar
                                </div>
                            )}
                        </div>
                        <h3 className="mt-4 font-black text-xl text-white drop-shadow-md">{userData.name}</h3>
                        <span className="inline-block mt-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-sm text-xs font-bold uppercase">{userData.role}</span>

                        {/* Bono de Eficacia */}
                        <div className="mt-8 bg-sky-900/40 border border-sky-500/30 p-4 rounded-sm text-center">
                            <div className="text-xs font-bold text-sky-400 mb-1">DESEMPEÑO GLOBAL</div>
                            <div className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(14,165,233,0.8)]">100%</div>
                            <div className="text-xs text-sky-200 mt-1">¡Excelente trabajo!</div>
                        </div>
                    </div>

                    {/* Datos del Usuario */}
                    <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 shadow-[0_0_20px_rgba(0,242,255,0.1)] rounded-sm p-6 md:p-8">
                        <div className="flex justify-between items-center mb-6 border-b border-cyan-500/20 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><User size={20} className="text-cyan-400" /> Información Personal</h3>
                            <button
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all rounded-sm shadow-lg ${
                                    isEditing 
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400'
                                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(0,242,255,0.3)] border border-cyan-400'
                                }`}
                            >
                                {isEditing ? <><Save size={16} /> Guardar</> : <><User size={16} /> Editar</>}
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                    <Mail size={14} /> CORREO ELECTRÓNICO
                                </label>
                                <input
                                    type="text"
                                    value={userData.email}
                                    disabled
                                    className="w-full bg-slate-800/50 border border-slate-700 text-slate-400 p-3 rounded-sm cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                    <Phone size={14} /> TELÉFONO / WHATSAPP
                                </label>
                                <input
                                    type="text"
                                    value={userData.phone}
                                    disabled={!isEditing}
                                    onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                                    className={`w-full p-3 rounded-sm transition-all focus:outline-none ${
                                        isEditing 
                                        ? 'bg-slate-800 border border-cyan-500 text-white shadow-[0_0_10px_rgba(0,242,255,0.1)]' 
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-300'
                                    }`}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                    <MapPin size={14} /> DIRECCIÓN O CORREO DE RESPALDO
                                </label>
                                <input
                                    type="text"
                                    value={userData.address}
                                    disabled
                                    className="w-full bg-slate-800/50 border border-slate-700 text-slate-400 p-3 rounded-sm cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Seguridad */}
                        <div className="mt-8 pt-6 border-t border-cyan-500/20">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Lock size={20} className="text-cyan-400" /> Seguridad y Accesos</h3>
                            
                            <div className="mb-6">
                                <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                    PIN DE ACCESO (Autorizaciones y Caja)
                                </label>
                                <input
                                    type="password"
                                    value={userData.pin}
                                    disabled={!isEditing}
                                    maxLength={4}
                                    placeholder="••••"
                                    onChange={(e) => setUserData({ ...userData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                    className={`w-full p-3 rounded-sm transition-all focus:outline-none text-2xl tracking-[1em] font-mono ${
                                        isEditing 
                                        ? 'bg-slate-800 border border-cyan-500 text-white shadow-[0_0_10px_rgba(0,242,255,0.1)]' 
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-300'
                                    }`}
                                />
                                <p className="text-xs text-slate-400 mt-2 font-medium">Úsalo para autorizar operaciones y firmar ventas en caja.</p>
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                    FOTO DE PERFIL (Cámara o Archivo)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    disabled={!isEditing}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const img = new Image();
                                            const objectUrl = URL.createObjectURL(file);
                                            img.src = objectUrl;
                                            img.onload = () => {
                                                const canvas = document.createElement('canvas');
                                                const MAX_WIDTH = 400;
                                                const MAX_HEIGHT = 400;
                                                let width = img.width;
                                                let height = img.height;

                                                if (width > height && width > MAX_WIDTH) {
                                                    height *= MAX_WIDTH / width;
                                                    width = MAX_WIDTH;
                                                } else if (height > MAX_HEIGHT) {
                                                    width *= MAX_HEIGHT / height;
                                                    height = MAX_HEIGHT;
                                                }
                                                canvas.width = width;
                                                canvas.height = height;
                                                const ctx = canvas.getContext('2d');
                                                ctx?.drawImage(img, 0, 0, width, height);
                                                
                                                const dataUrl = canvas.toDataURL('image/webp', 0.6);
                                                setUserData({ ...userData, photo: dataUrl });
                                                URL.revokeObjectURL(objectUrl);
                                            };
                                        }
                                    }}
                                    className={`w-full p-3 rounded-sm transition-all focus:outline-none text-sm ${
                                        isEditing 
                                        ? 'bg-slate-800 border border-cyan-500 text-white' 
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-400'
                                    }`}
                                />
                                <p className="text-xs text-slate-400 mt-2 font-medium">Selecciona un archivo local o toma una foto.</p>
                            </div>

                            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 rounded-sm text-sm font-bold transition-colors w-full sm:w-auto">
                                Cambiar Contraseña Principal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

