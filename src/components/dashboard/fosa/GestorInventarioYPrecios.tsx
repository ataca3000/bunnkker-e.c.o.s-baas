"use client";

import React, { useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { 
    Boxes, Search, Plus, Edit2, Check, X, 
    DollarSign, Package, AlertTriangle, Layers
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { acquireGlobalMutationLock, releaseGlobalMutationLock } from '@/lib/catalogSync';

interface GestorInventarioYPreciosProps {
    idAlmacen: string;
}

export function GestorInventarioYPrecios({ idAlmacen }: GestorInventarioYPreciosProps) {
    const { products, formatCurrency } = useCart();
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<number>(0);
    const [editStock, setEditStock] = useState<number>(0);
    const [editEstante, setEditEstante] = useState<string>('');
    const [editFila, setEditFila] = useState<string>('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        price: 0,
        stock: 0,
        category: 'General',
        estante: 'A-1',
        fila: 'F-1'
    });

    const filteredProducts = useMemo(() => {
        if (!search.trim()) return products.slice(0, 15);
        const q = search.toLowerCase();
        return products.filter((p: any) => 
            p.name.toLowerCase().includes(q) || 
            (p.barcode && p.barcode.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q))
        ).slice(0, 20);
    }, [products, search]);

    const handleStartEdit = (product: any) => {
        setEditingId(product.id);
        setEditPrice(product.price);
        setEditStock(product.stock);
        setEditEstante(product.estante || '');
        setEditFila(product.fila || '');
    };

    const handleSaveEdit = async (productId: string) => {
        acquireGlobalMutationLock();
        try {
            const payload = {
                id: productId,
                price: Number(editPrice),
                stock: Number(editStock),
                estante: editEstante,
                fila: editFila
            };
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo actualizar el producto.');
            }

            const current = products.find((p: any) => p.id === productId);
            if (current) {
                const { useERPStore } = await import('@/store/useERPStore');
                const updatedItem = {
                    ...current,
                    ...(data.data || {}),
                    price: Number(data.data?.price ?? editPrice),
                    stock: Number(data.data?.stock ?? editStock),
                    estante: data.data?.estante ?? editEstante,
                    fila: data.data?.fila ?? editFila
                };
                useERPStore.getState().updateProduct(updatedItem as any);
                try {
                    localStorage.setItem('_bunkker_cached_products', JSON.stringify(useERPStore.getState().products));
                } catch {}
            }
            const { broadcastSync } = await import('@/lib/syncNotifier');
            broadcastSync({ action: 'PRODUCT_UPDATED', id: productId, scope: 'products', skipServerPost: true });
            toast.success('Precio y stock actualizados en base de datos local.');
            setEditingId(null);
        } catch (err: any) {
            toast.error(err?.message || 'Error al actualizar producto.');
        } finally {
            releaseGlobalMutationLock();
        }
    };

    const handleCreateProduct = async () => {
        if (!newProduct.name.trim() || newProduct.price <= 0) {
            toast.warning('El nombre y precio son obligatorios.');
            return;
        }
        acquireGlobalMutationLock();
        try {
            const prodId = `PROD-${Date.now().toString().slice(-6)}`;
            const payload = {
                id: prodId,
                name: newProduct.name,
                price: Number(newProduct.price),
                stock: Number(newProduct.stock),
                category: newProduct.category,
                estante: newProduct.estante,
                fila: newProduct.fila
            };
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'No se pudo crear el producto.');
            }

            const { useERPStore } = await import('@/store/useERPStore');
            useERPStore.getState().addProduct((data.data || payload) as any);
            try {
                localStorage.setItem('_bunkker_cached_products', JSON.stringify(useERPStore.getState().products));
            } catch {}
            const { broadcastSync } = await import('@/lib/syncNotifier');
            broadcastSync({ action: 'PRODUCT_CREATED', id: prodId, scope: 'products', skipServerPost: true });

            toast.success(`Producto "${newProduct.name}" dado de alta con éxito.`);
            setIsAddingNew(false);
            setNewProduct({ name: '', price: 0, stock: 0, category: 'General', estante: 'A-1', fila: 'F-1' });
        } catch (err: any) {
            toast.error(err?.message || 'Error al crear producto.');
        } finally {
            releaseGlobalMutationLock();
        }
    };

    return (
        <section className="bg-[#0f172a]/80 border border-indigo-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Boxes size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">GOBERNANZA EXCLUSIVA DE ALMACÉN</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">
                                Autoridad Única de Precios & Stock
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">Solo este rol puede fijar precios base y modificar existencias físicas</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsAddingNew(!isAddingNew)}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
                >
                    <Plus size={14} />
                    <span>{isAddingNew ? 'Cancelar' : 'Nuevo Producto'}</span>
                </button>
            </div>

            {/* Formulario rápido de nuevo producto */}
            {isAddingNew && (
                <div className="my-4 p-4 rounded-xl bg-slate-900/95 border border-indigo-500/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                        <label className="text-slate-400 block mb-1">Nombre:</label>
                        <input
                            type="text"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            placeholder="Ej. Cemento Gris 50kg"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 block mb-1">Precio Oficial ($):</label>
                        <input
                            type="number"
                            value={newProduct.price || ''}
                            onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 block mb-1">Stock Físico Inicial:</label>
                        <input
                            type="number"
                            value={newProduct.stock || ''}
                            onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value, 10) || 0 })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 block mb-1">Estante:</label>
                        <input
                            type="text"
                            value={newProduct.estante}
                            onChange={(e) => setNewProduct({ ...newProduct, estante: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 block mb-1">Fila/Nivel:</label>
                        <input
                            type="text"
                            value={newProduct.fila}
                            onChange={(e) => setNewProduct({ ...newProduct, fila: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleCreateProduct}
                            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
                        >
                            Guardar en Catálogo ADN
                        </button>
                    </div>
                </div>
            )}

            {/* Barra de búsqueda de inventario */}
            <div className="relative my-3">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar por nombre, categoría o código de barra..."
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
            </div>

            {/* Tabla ligera de precios y stock */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                        <tr>
                            <th className="py-2 px-3">Producto</th>
                            <th className="py-2 px-3">Ubicación</th>
                            <th className="py-2 px-3">Stock Físico</th>
                            <th className="py-2 px-3">Precio Oficial</th>
                            <th className="py-2 px-3 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                        {filteredProducts.map((p: any) => {
                            const isEditing = editingId === p.id;

                            return (
                                <tr key={p.id} className="hover:bg-slate-900/40">
                                    <td className="py-2 px-3 font-sans font-medium text-white truncate max-w-[200px]">
                                        {p.name}
                                    </td>
                                    <td className="py-2 px-3 text-slate-400">
                                        {isEditing ? (
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={editEstante}
                                                    onChange={(e) => setEditEstante(e.target.value)}
                                                    className="w-12 bg-slate-950 border border-slate-700 px-1 py-0.5 rounded text-[11px]"
                                                />
                                                <input
                                                    type="text"
                                                    value={editFila}
                                                    onChange={(e) => setEditFila(e.target.value)}
                                                    className="w-12 bg-slate-950 border border-slate-700 px-1 py-0.5 rounded text-[11px]"
                                                />
                                            </div>
                                        ) : (
                                            `${p.estante || 'A-1'} / ${p.fila || 'F-1'}`
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editStock}
                                                onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                                                className="w-16 bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-white"
                                            />
                                        ) : (
                                            <span className={p.stock <= 5 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                                {p.stock} uds
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                                className="w-20 bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-cyan-400 font-bold"
                                            />
                                        ) : (
                                            <span className="text-cyan-400 font-bold">
                                                {formatCurrency(p.price)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleSaveEdit(p.id)}
                                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                                    title="Guardar"
                                                >
                                                    <Check size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                                    title="Cancelar"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleStartEdit(p)}
                                                className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                                                title="Editar precio/stock"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default GestorInventarioYPrecios;
