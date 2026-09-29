"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Book, Terminal, Store, Shield, Cpu, MonitorPlay } from 'lucide-react';

export default function DocsPortal() {
    const [activeTab, setActiveTab] = useState('inicio');

    const menu = [
        { id: 'inicio', title: 'Inicio Rápido', icon: <MonitorPlay className="w-4 h-4 mr-2" /> },
        { id: 'pos', title: 'Punto de Venta', icon: <Store className="w-4 h-4 mr-2" /> },
        { id: 'canvas', title: 'Diseñador Canvas', icon: <Book className="w-4 h-4 mr-2" /> },
        { id: 'ia', title: 'Clasificador IA', icon: <Cpu className="w-4 h-4 mr-2" /> },
        { id: 'roles', title: 'Control de Roles', icon: <Shield className="w-4 h-4 mr-2" /> },
        { id: 'tests', title: 'QA & Testing', icon: <Terminal className="w-4 h-4 mr-2" /> },
    ];

    return (
        <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Admin.com Docs
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Manual de Operación v2.0</p>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {menu.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-all ${
                                activeTab === item.id 
                                ? 'bg-blue-50 text-blue-700 shadow-sm' 
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            {item.icon}
                            {item.title}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-100">
                    <Link href="/login" className="text-sm text-blue-600 hover:underline font-semibold">
                        &larr; Volver al Sistema
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto p-12">
                    {activeTab === 'inicio' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">Bienvenido a tu ERP</h2>
                            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                                Estás frente al Ecosistema Tecnológico de Vanguardia. Este sistema está diseñado 
                                para funcionar a prueba de fallas (Local-First) y sincronizar tus ventas con la nube.
                            </p>
                            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-8">
                                <h3 className="font-bold text-blue-900 mb-2">Importante: Hardware Lock Activo</h3>
                                <p className="text-blue-800 text-sm">
                                    Tu licencia está vinculada a la huella digital (MAC) de este equipo. 
                                    Para conectar sucursales adicionales, adquiere licencias extra desde el panel de facturación.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                                    <Store className="w-8 h-8 text-blue-600 mb-4" />
                                    <h4 className="font-bold text-gray-900">Vende Rápido</h4>
                                    <p className="text-sm text-gray-500 mt-2">Aprende a cobrar usando el lector láser con respuesta de &lt;70ms.</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                                    <Book className="w-8 h-8 text-purple-600 mb-4" />
                                    <h4 className="font-bold text-gray-900">Diseña tu Tienda</h4>
                                    <p className="text-sm text-gray-500 mt-2">Usa el Canvas Magnético para personalizar colores y textos sin código.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'inicio' && (
                        <div className="animate-in fade-in duration-500 flex flex-col items-center justify-center h-[60vh] text-center">
                            <div className="bg-gray-100 p-6 rounded-full mb-6">
                                <Terminal className="w-12 h-12 text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sección en Construcción</h2>
                            <p className="text-gray-500 max-w-md">
                                Estamos redactando los tutoriales interactivos para la sección de 
                                <span className="font-bold text-gray-700 ml-1">
                                    {menu.find(m => m.id === activeTab)?.title}
                                </span>. 
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
