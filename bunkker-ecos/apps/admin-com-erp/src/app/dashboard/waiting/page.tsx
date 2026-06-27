"use client";

import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WaitingRoom() {
    const { profile, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-500"></div>
                
                <div className="flex justify-center mb-6">
                    <div className="bg-orange-500/10 p-4 rounded-full border border-orange-500/20">
                        <ShieldAlert size={48} className="text-orange-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-white mb-2 uppercase">Modo Cliente / Nodo</h1>
                <p className="text-slate-400 mb-8 text-sm">
                    Tu dispositivo se ha enlazado exitosamente al ecosistema, pero actualmente tienes el rol de <strong className="text-orange-400">{profile?.role || 'client'}</strong>.
                </p>

                <div className="bg-[#1e293b] rounded-xl p-4 mb-8 border border-slate-700">
                    <div className="flex items-center justify-center gap-3 text-sky-400 mb-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="font-bold">Esperando Autorización...</span>
                    </div>
                    <p className="text-xs text-slate-500">
                        Pídele al Administrador (Super Admin) que entre a su panel y te asigne un rol de trabajador (Ventas, Inventario, Repartidor, etc.) para desbloquear tu acceso.
                    </p>
                </div>

                <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-bold text-sm"
                >
                    <LogOut size={16} /> Salir y Cambiar de Cuenta
                </button>
            </motion.div>
        </div>
    );
}
