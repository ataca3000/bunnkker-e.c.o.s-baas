"use client";

import { useState, useEffect } from 'react';
import { Camera, Save, User, MapPin, Mail, Phone, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function UserProfile() {
    const { profile, isReadOnly } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [userData, setUserData] = useState({
        name: 'Usuario ERP',
        role: 'Colaborador',
        email: 'usuario@sistema.com',
        phone: '',
        address: 'No registrada',
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200'
    });

    useEffect(() => {
        if (profile) {
            setUserData({
                name: profile.displayName || 'Administrador',
                role: profile.role === 'superadmin' ? 'Super Administrador' : (profile.role === 'admin' ? 'Administrador' : 'Colaborador'),
                email: profile.email || 'admin@sistema.com',
                phone: profile.recoveryPhone || '',
                address: profile.recoveryEmail || 'No registrada',
                photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200'
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (isReadOnly) {
            alert("🔒 Modo Demo: No se pueden guardar cambios.");
            setIsEditing(false);
            return;
        }

        try {
            if (profile?.uid) {
                const userRef = doc(db, 'users', profile.uid);
                await updateDoc(userRef, {
                    recoveryPhone: userData.phone,
                });
                alert("Perfil actualizado correctamente");
            }
        } catch (err) {
            console.error("Error saving profile:", err);
            alert("Error al guardar cambios.");
        } finally {
            setIsEditing(false);
        }
    };

    return (
        <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#1a1a1a', marginBottom: '2rem' }}>MI PERFIL</h1>

                <div className="card-sanjose" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>

                    {/* Foto de Perfil */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: '150px', height: '150px', margin: '0 auto', borderRadius: '50%', overflow: 'hidden', border: '5px solid #0ea5e9' }}>
                            <img src={userData.photo} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {isEditing && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '5px', fontSize: '0.7rem', cursor: 'pointer' }}>
                                    <Camera size={16} /> Cambiar
                                </div>
                            )}
                        </div>
                        <h3 style={{ marginTop: '1rem', fontWeight: '900', fontSize: '1.2rem' }}>{userData.name}</h3>
                        <span style={{ background: '#E30613', color: 'white', padding: '3px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>{userData.role}</span>

                        {/* Bono de Eficacia */}
                        <div style={{ marginTop: '2rem', background: '#FFCB05', padding: '1rem', borderRadius: '8px', color: '#333' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>DESEMPEÑO GLOBAL</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0ea5e9' }}>100%</div>
                            <div style={{ fontSize: '0.7rem' }}>¡Excelente trabajo!</div>
                        </div>
                    </div>

                    {/* Datos del Usuario */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#555' }}>Información Personal</h3>
                            <button
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                className={isEditing ? "btn-sanjose" : "btn-sanjose-secondary"}
                                style={{ padding: '8px 15px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                {isEditing ? <><Save size={16} /> Guardar</> : <><User size={16} /> Editar</>}
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Mail size={14} /> CORREO ELECTRÓNICO
                                </label>
                                <input
                                    type="text"
                                    value={userData.email}
                                    disabled
                                    style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd', background: '#eee', color: '#666' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Phone size={14} /> TELÉFONO / WHATSAPP
                                </label>
                                <input
                                    type="text"
                                    value={userData.phone}
                                    disabled={!isEditing}
                                    onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                                    style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: isEditing ? '1px solid #0ea5e9' : '1px solid #ddd', background: isEditing ? 'white' : '#f9f9f9' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <MapPin size={14} /> DIRECCIÓN O CORREO DE RESPALDO
                                </label>
                                <input
                                    type="text"
                                    value={userData.address}
                                    disabled
                                    style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd', background: '#eee', color: '#666' }}
                                />
                            </div>
                        </div>

                        {/* Seguridad */}
                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#555', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Lock size={16} /> Seguridad
                            </h3>
                            <button style={{ background: 'none', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                Cambiar Contraseña
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

