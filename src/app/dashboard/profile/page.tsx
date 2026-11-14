"use client";

import { useState, useEffect } from 'react';
import { Camera, Save, User, MapPin, Mail, Phone, Lock, Sliders, Printer, Smartphone, ScanLine } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/lib/toast';
import HardwareSettingsModal from '@/components/hardware/HardwareSettingsModal';
import {
    loadHardwareConfig as readStoredHardwareConfig,
    DEFAULT_HARDWARE_CONFIG,
    type HardwareConfig,
} from '@/lib/hardwareConfig';

export default function UserProfile() {
    const { profile, isReadOnly } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
    const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>(DEFAULT_HARDWARE_CONFIG);
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [userData, setUserData] = useState({
        name: 'Usuario ERP',
        role: 'Colaborador',
        email: 'usuario@sistema.com',
        phone: '',
        address: 'No registrada',
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200'
    });

    const loadHardwareConfig = () => {
        setHardwareConfig(readStoredHardwareConfig());
    };

    useEffect(() => {
        loadHardwareConfig();
    }, [hardwareModalOpen]);

    useEffect(() => {
        if (profile) {
            setUserData({
                name: profile.displayName || 'Administrador',
                role: profile.role === 'superadmin' ? 'Super Administrador' : (profile.role === 'admin' ? 'Administrador' : 'Colaborador'),
                email: profile.email || 'admin@sistema.com',
                phone: profile.recoveryPhone || '',
                address: profile.recoveryEmail || 'No registrada',
                photo: (profile as any).photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200'
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (isReadOnly) {
            toast.warning('No se pueden guardar cambios en Modo Demo.', '🔒 Demo');
            setIsEditing(false);
            return;
        }

        if (!newPin) {
            setIsEditing(false);
            return;
        }
        const pinLetters = newPin.match(/[A-Za-z]/g) || [];
        const pinDigits = newPin.match(/\d/g) || [];
        if (newPin.length !== 5 || pinLetters.length !== 1 || pinDigits.length !== 4) {
            toast.warning('El PIN debe tener una letra y cuatro números.');
            return;
        }
        if (newPin !== confirmPin) {
            toast.warning('Los dos PIN no coinciden.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CHANGE_PIN', newPin })
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar el PIN.');

            setNewPin('');
            setConfirmPin('');
            setIsEditing(false);
            toast.success('PIN de acceso actualizado para este perfil.', 'Perfil');
        } catch (err: unknown) {
            console.error("Error saving profile:", err);
            toast.error(err instanceof Error ? err.message : 'Error interno al actualizar el PIN.');
        } finally {
            setIsSaving(false);
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
                    <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 shadow-[0_0_20px_rgba(0,242,255,0.1)] rounded-sm p-[8px] text-center">
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
                    <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 shadow-[0_0_20px_rgba(0,242,255,0.1)] rounded-sm p-[8px] md:p-8">
                        <div className="flex justify-between items-center mb-6 border-b border-cyan-500/20 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><User size={20} className="text-cyan-400" /> Información Personal</h3>
                            <button
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                disabled={isSaving}
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
                                    CAMBIAR PIN DE ACCESO DE ESTE PERFIL
                                </label>
                                <input
                                    type="password"
                                    value={newPin}
                                    disabled={!isEditing}
                                    maxLength={5}
                                    autoComplete="new-password"
                                    placeholder="A1234"
                                    onChange={(e) => setNewPin(e.target.value.replace(/[^a-z\d]/gi, '').slice(0, 5))}
                                    className={`w-full p-3 rounded-sm transition-all focus:outline-none text-xl tracking-[0.35em] font-mono ${
                                        isEditing 
                                        ? 'bg-slate-800 border border-cyan-500 text-white shadow-[0_0_10px_rgba(0,242,255,0.1)]' 
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-300'
                                    }`}
                                />
                                {isEditing && (
                                    <input
                                        type="password"
                                        value={confirmPin}
                                        maxLength={5}
                                        autoComplete="new-password"
                                        placeholder="Confirmar PIN nuevo"
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/[^a-z\d]/gi, '').slice(0, 5))}
                                        className="mt-3 w-full bg-slate-800 border border-cyan-500/50 text-white p-3 rounded-sm focus:outline-none focus:border-cyan-400"
                                    />
                                )}
                                <p className="text-xs text-slate-400 mt-2 font-medium">Usa una letra y cuatro números. Solo tú puedes cambiar el PIN de tu perfil; nunca se muestra el actual.</p>
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

                        {/* ── SECCIÓN DE PERIFÉRICOS & HARDWARE (Impresoras, Escáneres, Wi-Fi / Bluetooth) ── */}
                        <div className="mt-8 pt-6 border-t border-cyan-500/20">
                            <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 shadow-xl backdrop-blur-md">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-base font-black text-white flex items-center gap-2">
                                            <Sliders className="text-cyan-400 w-5 h-5" />
                                            <span>Dispositivos & Hardware de Estación</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                                                {userData.role}
                                            </span>
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                                            Ajustes de periféricos para este dispositivo y rol. Por defecto opera con <strong className="text-cyan-300">Ticket Digital</strong> y <strong className="text-cyan-300">Escáner con Cámara</strong> para que cualquier usuario pueda operar sin requerir impresoras ni pistolas físicas.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHardwareModalOpen(true)}
                                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-cyan-500/20 shrink-0 flex items-center gap-2"
                                    >
                                        <Sliders size={15} />
                                        <span>Configurar Hardware</span>
                                    </button>
                                </div>

                                {/* Tarjetas informativas de estado activo */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    {/* Impresión / Ticket */}
                                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                                        <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                                            {hardwareConfig.printerMode === 'digital' ? (
                                                <Smartphone size={18} />
                                            ) : (
                                                <Printer size={18} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Emisión de Tickets</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    hardwareConfig.printerMode === 'digital' 
                                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                }`}>
                                                    {hardwareConfig.printerMode === 'digital' ? 'DEFAULT: DIGITAL' : hardwareConfig.printerMode.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="text-sm font-black text-white mt-0.5 truncate">
                                                {hardwareConfig.printerMode === 'digital' && '📱 Ticket Digital (Pantalla, QR y WhatsApp)'}
                                                {hardwareConfig.printerMode === 'serial' && '🔌 Impresora USB / Serial (Cable)'}
                                                {hardwareConfig.printerMode === 'bluetooth' && '📶 Impresora Bluetooth (BLE)'}
                                                {hardwareConfig.printerMode === 'network' && '🌐 Impresora Wi-Fi / Red Local'}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                                {hardwareConfig.printerMode === 'digital' 
                                                    ? 'No requiere impresora física. El cliente recibe o escanea su comprobante vía QR o enlace directo.' 
                                                    : 'Envía comandos ESC/POS directamente a la impresora térmica configurada.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Escáner de Códigos, QR & NFC */}
                                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                                        <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                                            {hardwareConfig.scannerMode === 'camera' ? (
                                                <Camera size={18} />
                                            ) : (
                                                <ScanLine size={18} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Escáner, QR & NFC</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    hardwareConfig.scannerMode === 'camera' 
                                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                                                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                }`}>
                                                    {hardwareConfig.scannerMode === 'camera' ? 'CÁMARA QR' : 'LÁSER HID'}
                                                </span>
                                            </div>
                                            <div className="text-sm font-black text-white mt-0.5 truncate">
                                                {hardwareConfig.scannerMode === 'camera' && '📷 Cámara QR / Barras del Dispositivo'}
                                                {hardwareConfig.scannerMode === 'hid' && '🔫 Pistola Láser HID (USB / BT)'}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                                {hardwareConfig.nfcEnabled
                                                    ? `NFC activo (${hardwareConfig.nfcMode === 'web_nfc' ? 'Web NFC' : 'USB HID'}). ${hardwareConfig.qrContinuousMode ? 'QR continuo.' : 'QR unitario.'}`
                                                    : (hardwareConfig.scannerMode === 'camera'
                                                        ? 'Usa el lente de tu smartphone, tablet o webcam para QR y barras.'
                                                        : 'Recibe ráfagas directas de teclado mediante pistola lectora láser.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Dispositivos & Hardware */}
            <HardwareSettingsModal 
                isOpen={hardwareModalOpen} 
                onClose={() => setHardwareModalOpen(false)} 
            />
        </div>
    );
}


