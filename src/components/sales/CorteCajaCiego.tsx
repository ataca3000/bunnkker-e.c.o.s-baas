import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calculator, X, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react';

interface Denomination {
    value: number;
    label: string;
    type: 'billete' | 'moneda';
}

const DENOMINATIONS: Denomination[] = [
    { value: 1000, label: '$1,000', type: 'billete' },
    { value: 500, label: '$500', type: 'billete' },
    { value: 200, label: '$200', type: 'billete' },
    { value: 100, label: '$100', type: 'billete' },
    { value: 50, label: '$50', type: 'billete' },
    { value: 20, label: '$20', type: 'billete' },
    { value: 10, label: '$10', type: 'moneda' },
    { value: 5, label: '$5', type: 'moneda' },
    { value: 2, label: '$2', type: 'moneda' },
    { value: 1, label: '$1', type: 'moneda' },
    { value: 0.5, label: '50¢', type: 'moneda' },
];

interface CorteCajaCiegoProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (montoDeclarado: number) => void;
}

export default function CorteCajaCiego({ isOpen, onClose, onConfirm }: CorteCajaCiegoProps) {
    const [counts, setCounts] = useState<Record<number, number>>({});
    const [step, setStep] = useState<'COUNT' | 'CONFIRM' | 'DONE'>('COUNT');

    const totalCalculado = useMemo(() => {
        return DENOMINATIONS.reduce((acc, den) => {
            return acc + (den.value * (counts[den.value] || 0));
        }, 0);
    }, [counts]);

    const handleIncrement = (val: number) => setCounts(p => ({ ...p, [val]: (p[val] || 0) + 1 }));
    const handleDecrement = (val: number) => setCounts(p => ({ ...p, [val]: Math.max(0, (p[val] || 0) - 1) }));
    const handleChange = (val: number, count: number) => setCounts(p => ({ ...p, [val]: count }));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-[#0a0a0c]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white/10 border border-white/20 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="bg-sky-500 p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black italic text-white flex items-center gap-3 drop-shadow-sm">
                            <Calculator size={32} /> 
                            CORTE DE CAJA CIEGO
                        </h2>
                        <p className="text-sky-100 font-medium mt-1">Cuenta el efectivo real de la caja registradora.</p>
                    </div>
                    <button onClick={onClose} className="bg-white/20 hover:bg-white/40 p-2 rounded-full transition text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1">
                    {step === 'COUNT' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Billetes */}
                                <div>
                                    <h3 className="text-xl font-bold text-sky-400 mb-4 border-b border-white/10 pb-2">💵 Billetes</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {DENOMINATIONS.filter(d => d.type === 'billete').map(den => (
                                            <div key={den.value} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5 hover:border-sky-500/50 transition">
                                                <div className="text-lg font-black text-white w-20">{den.label}</div>
                                                <div className="flex items-center gap-4">
                                                    <button onClick={() => handleDecrement(den.value)} className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 font-bold hover:bg-red-500 hover:text-white transition flex items-center justify-center">-</button>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={counts[den.value] || ''} 
                                                        onChange={(e) => handleChange(den.value, parseInt(e.target.value) || 0)}
                                                        className="w-16 h-10 bg-black/30 text-white font-bold text-center rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                                                        placeholder="0"
                                                    />
                                                    <button onClick={() => handleIncrement(den.value)} className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-white transition flex items-center justify-center">+</button>
                                                </div>
                                                <div className="w-24 text-right font-mono text-sky-300 font-bold">
                                                    ${((counts[den.value] || 0) * den.value).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Monedas */}
                                <div>
                                    <h3 className="text-xl font-bold text-yellow-400 mb-4 border-b border-white/10 pb-2">🪙 Monedas</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {DENOMINATIONS.filter(d => d.type === 'moneda').map(den => (
                                            <div key={den.value} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5 hover:border-yellow-500/50 transition">
                                                <div className="text-lg font-black text-white w-20">{den.label}</div>
                                                <div className="flex items-center gap-4">
                                                    <button onClick={() => handleDecrement(den.value)} className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 font-bold hover:bg-red-500 hover:text-white transition flex items-center justify-center">-</button>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={counts[den.value] || ''} 
                                                        onChange={(e) => handleChange(den.value, parseInt(e.target.value) || 0)}
                                                        className="w-16 h-10 bg-black/30 text-white font-bold text-center rounded-xl border border-white/10 focus:border-yellow-500 outline-none"
                                                        placeholder="0"
                                                    />
                                                    <button onClick={() => handleIncrement(den.value)} className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-white transition flex items-center justify-center">+</button>
                                                </div>
                                                <div className="w-24 text-right font-mono text-yellow-300 font-bold">
                                                    ${((counts[den.value] || 0) * den.value).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'CONFIRM' && (
                        <div className="text-center py-12">
                            <AlertTriangle size={64} className="text-yellow-400 mx-auto mb-6" />
                            <h3 className="text-3xl font-black text-white mb-4">¿Confirmar Corte?</h3>
                            <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
                                Estás declarando un total físico en caja de:
                            </p>
                            <div className="text-6xl font-black text-sky-400 mb-12 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                                ${totalCalculado.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <p className="text-red-400 font-bold text-sm uppercase tracking-widest bg-red-500/10 inline-block p-3 rounded-xl border border-red-500/20">
                                ESTA ACCIÓN NO SE PUEDE DESHACER Y QUEDARÁ REGISTRADA EN AUDITORÍA.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-black/40 p-6 flex justify-between items-center border-t border-white/10">
                    <div className="text-left">
                        {step === 'COUNT' && (
                            <>
                                <span className="text-white/40 uppercase font-bold text-xs tracking-widest block mb-1">Monto Declarado (Oculto al dueño hasta auditar)</span>
                                <span className="text-2xl font-black text-sky-400">${totalCalculado.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </>
                        )}
                    </div>
                    
                    <div className="flex gap-4">
                        {step === 'COUNT' ? (
                            <button 
                                onClick={() => setStep('CONFIRM')}
                                disabled={totalCalculado === 0}
                                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-lg px-8 py-4 rounded-2xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Validar Conteo <CheckCircle size={24} />
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setStep('COUNT')}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold uppercase px-8 py-4 rounded-2xl transition-all"
                                >
                                    Corregir
                                </button>
                                <button 
                                    onClick={() => onConfirm(totalCalculado)}
                                    className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase text-lg px-8 py-4 rounded-2xl transition-all shadow-[0_0_30px_rgba(14,165,233,0.4)] flex items-center gap-2"
                                >
                                    CERRAR TURNO <DollarSign size={24} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
