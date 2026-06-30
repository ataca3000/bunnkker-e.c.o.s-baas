"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StealthLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const res = await fetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            const data = await res.json();
            // The server dictates the route based on the hidden role
            router.push(data.redirectTo);
        } else {
            alert('Credenciales inválidas');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Bienvenido</h1>
                <input 
                    type="email" 
                    placeholder="Correo Electrónico" 
                    className="w-full p-3 mb-4 border rounded"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input 
                    type="password" 
                    placeholder="Contraseña" 
                    className="w-full p-3 mb-6 border rounded"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">
                    Entrar
                </button>
            </form>
        </div>
    );
}
