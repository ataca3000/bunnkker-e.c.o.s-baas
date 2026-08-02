'use client';

import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

export default function ImportCSVButton({ onSuccess }: { onSuccess?: () => void }) {
    const [isImporting, setIsImporting] = useState(false);
    const [preview, setPreview] = useState<{ headers: string[], rows: string[][] } | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length > 0) {
                const headers = lines[0].split(',').map(h => h.trim());
                const rows = lines.slice(1, 6).map(line => line.split(',').map(c => c.trim()));
                setPreview({ headers, rows });
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
        if (!file) return;
        setIsImporting(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('csv', file);

            const res = await fetch('/api/import/products', {
                method: 'POST',
                headers: {
                    'x-tenant-id': 'default'
                },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                setResult({
                    message: `${data.imported} productos importados, ${data.skipped} omitidos.`,
                    errors: data.errors
                });
                if (onSuccess) {
                    onSuccess();
                }
            } else {
                setResult({ error: data.error });
            }
        } catch (error: any) {
            setResult({ error: error.message });
        } finally {
            setIsImporting(false);
        }
    };

    const handleClose = () => {
        setPreview(null);
        setFile(null);
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600/20 text-blue-400 px-5 py-3 rounded-sm font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-blue-600/30 transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-500/50 active:scale-95 flex-1 md:flex-none justify-center"
            >
                <Upload size={16} />
                <span>Importar CSV/Excel</span>
            </button>
            
            <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {preview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 text-white">
                        <h2 className="text-xl font-bold mb-4">Vista Previa de Importación</h2>
                        
                        {!result ? (
                            <>
                                <p className="mb-4 text-slate-300 text-sm">
                                    Se detectaron las siguientes columnas. Asegúrate de que coincidan con: <strong>nombre, precio, stock, categoria, sku</strong>.
                                </p>
                                <div className="overflow-x-auto mb-6 border border-slate-700 rounded-md">
                                    <table className="w-full text-left border-collapse min-w-max">
                                        <thead>
                                            <tr>
                                                {preview.headers.map((h: string, i: number) => (
                                                    <th key={i} className="border-b border-slate-700 p-2 text-sm font-semibold bg-slate-800 text-slate-200">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.rows.map((row: string[], i: number) => (
                                                <tr key={i} className="hover:bg-slate-800/50">
                                                    {row.map((cell: string, j: number) => (
                                                        <td key={j} className="border-b border-slate-800 p-2 text-sm text-slate-400">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={handleClose}
                                        disabled={isImporting}
                                        className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 border border-slate-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleImport}
                                        disabled={isImporting}
                                        className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2 font-semibold"
                                    >
                                        {isImporting ? 'Importando...' : 'Confirmar Importación'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div>
                                {result.error ? (
                                    <div className="p-4 bg-red-900/50 border border-red-800 rounded-md text-red-200 mb-4">
                                        Error: {result.error}
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-4 bg-emerald-900/50 border border-emerald-800 rounded-md text-emerald-200 mb-4">
                                            {result.message}
                                        </div>
                                        {result.errors && result.errors.length > 0 && (
                                            <div className="mt-4">
                                                <h3 className="font-semibold text-red-400 mb-2">Errores por fila:</h3>
                                                <ul className="text-sm text-slate-300 max-h-40 overflow-y-auto space-y-1 bg-slate-950 p-3 rounded-md border border-slate-800">
                                                    {result.errors.map((err: any, idx: number) => (
                                                        <li key={idx}><strong>Fila {err.row}:</strong> {err.reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="mt-6 flex justify-end">
                                    <button 
                                        onClick={handleClose}
                                        className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
