"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@bunkker/core';
import { type Product } from '@/context/CartContext';

export default function CFDIModal({ product, onClose }: { product: Product, onClose: () => void }) {
    const { profile } = useAuth();
    const [rfc, setRfc] = useState('');
    const [isValidRfc, setIsValidRfc] = useState(true);
    const [legalName, setLegalName] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [taxSystem, setTaxSystem] = useState('');
    const [usoCfdi, setUsoCfdi] = useState('G03');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidRfc || !rfc || !legalName || !zipCode) return;
        
        setLoading(true);
        try {
            // Obtener token de autenticación
            const currentUser = auth.currentUser;
            if (!currentUser) {
                alert('Debes iniciar sesión para facturar.');
                setLoading(false);
                return;
            }
            const idToken = await currentUser.getIdToken();

            const response = await fetch('/api/billing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    customer: {
                        legal_name: legalName,
                        tax_id: rfc,
                        tax_system: taxSystem,
                        zip: zipCode,
                    },
                    clientItems: [{
                        id: product.id,
                        quantity: 1
                    }],
                    payment_form: paymentMethod,
                    use: usoCfdi
                }),
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(true);
            } else {
                alert(`Error de Facturación: ${data.error}`);
            }
        } catch (error) {
            alert("No se pudo conectar con el servidor de facturación.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1100] p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-sanjose bg-white w-full max-w-[500px] p-8 relative rounded-2xl"
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors z-10"
                    title="Cerrar"
                    aria-label="Cerrar"
                >
                    <X size={24} color="#333" />
                </button>

                <div className="flex items-center gap-3 mb-6 text-[#0ea5e9]">
                    <FileText size={28} />
                    <h2 className="text-2xl font-black m-0 leading-tight">Generar CFDI (Factura)</h2>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-green-600 mb-4">¡Factura Generada!</h3>
                        <p className="text-gray-600 mb-8">
                            La factura electrónica para <strong>{product.name}</strong> ha sido enviada a tu correo registrado o está lista para descargar.
                        </p>
                        <button onClick={onClose} className="btn-sanjose w-full py-3 font-bold">
                            CERRAR
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="bg-gray-100 p-4 rounded-xl mb-6">
                            <div className="text-[0.7rem] text-gray-500 uppercase font-bold">Producto a facturar</div>
                            <div className="font-bold text-lg text-gray-900">{product.name}</div>
                            <div className="font-black text-[#E30613] mt-1">${product.price.toLocaleString()} MXN</div>
                        </div>

                        <form onSubmit={handleGenerate}>
                            <div className="mb-4">
                                <label className="block mb-1 font-bold text-sm text-gray-800">Nombre o Razón Social *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Como aparece en la Constancia Fiscal"
                                    value={legalName}
                                    onChange={(e) => setLegalName(e.target.value.toUpperCase())}
                                    className="w-full p-3 rounded-lg border border-gray-300 uppercase outline-none focus:border-[#0ea5e9] transition-all"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 font-bold text-sm text-gray-800">
                                    RFC de Facturación *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. ABCD123456EF7"
                                    value={rfc}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase().replace(/\s/g, '');
                                        setRfc(val);
                                        const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z\d]{3}$/;
                                        setIsValidRfc(val === '' || rfcRegex.test(val));
                                    }}
                                    className={`w-full p-3 rounded-lg border uppercase outline-none transition-all ${isValidRfc ? 'border-gray-300 focus:border-[#0ea5e9]' : 'border-red-500 focus:border-red-600'}`}
                                />
                                {!isValidRfc && <p className="text-red-500 text-[0.7rem] mt-1 font-bold">Formato de RFC inválido</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block mb-1 font-bold text-sm text-gray-800">C.P. Fiscal *</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={5}
                                        placeholder="00000"
                                        value={zipCode}
                                        onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
                                        className="w-full p-3 rounded-lg border border-gray-300 outline-none focus:border-[#0ea5e9] transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1 font-bold text-sm text-gray-800">Régimen Fiscal *</label>
                                    <select
                                        required
                                        value={taxSystem}
                                        onChange={(e) => setTaxSystem(e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-300 bg-white outline-none focus:border-[#0ea5e9] transition-all"
                                    >
                                        <option value="" disabled>Seleccionar...</option>
                                        <option value="601">601 - General de Ley</option>
                                        <option value="612">612 - Personas Físicas</option>
                                        <option value="626">626 - RESICO</option>
                                        <option value="605">605 - Sueldos y Salarios</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 font-bold text-sm text-gray-800">Uso de CFDI *</label>
                                <select
                                    required
                                    value={usoCfdi}
                                    onChange={(e) => setUsoCfdi(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 bg-white outline-none focus:border-[#0ea5e9] transition-all"
                                >
                                    <option value="G01">G01 - Adquisición de mercancías</option>
                                    <option value="G03">G03 - Gastos en general</option>
                                    <option value="S01">S01 - Sin efectos fiscales</option>
                                    <option value="CP01">CP01 - Pagos</option>
                                </select>
                            </div>

                            <div className="mb-6">
                                <label htmlFor="paymentMethod" className="block mb-1 font-bold text-sm text-gray-800">
                                    Forma de Pago *
                                </label>
                                <select
                                    id="paymentMethod"
                                    required
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 bg-white outline-none focus:border-[#0ea5e9] transition-all"
                                    title="Selecciona una forma de pago"
                                >
                                    <option value="" disabled>Selecciona una opción</option>
                                    <option value="01">01 - Efectivo</option>
                                    <option value="02">02 - Cheque nominativo</option>
                                    <option value="03">03 - Transferencia electrónica</option>
                                    <option value="04">04 - Tarjeta de crédito</option>
                                    <option value="28">28 - Tarjeta de débito</option>
                                    <option value="99">99 - Por definir</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !rfc || !isValidRfc || !paymentMethod}
                                className={`btn-sanjose w-full p-4 font-bold text-base flex justify-center items-center transition-all ${(loading || !rfc || !isValidRfc || !paymentMethod) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                {loading ? 'GENERANDO CFDI...' : 'EMITIR FACTURA AHORA'}
                            </button>
                        </form>
                    </>
                )}
            </motion.div>
        </div>
    );
}
