import React from 'react';
import { LayoutTemplate, Type, Image as ImageIcon, ShoppingBag, Info, Phone, Target, Trash2, PlusCircle, PaintBucket, Palette } from 'lucide-react';
import type { BlockConfig, BlockType } from './Types';

interface SidebarProps {
    selectedBlock?: BlockConfig;
    onUpdateBlock: (data: any) => void;
    onRemoveBlock: () => void;
    onAddBlock: (type: BlockType) => void;
}

export default function SidebarBuilder({ selectedBlock, onUpdateBlock, onRemoveBlock, onAddBlock }: SidebarProps) {

    const BLOCK_TYPES: { id: BlockType; label: string; icon: any }[] = [
        { id: 'header', label: 'Cabecera (Header)', icon: LayoutTemplate },
        { id: 'hero', label: 'Portada Principal', icon: ImageIcon },
        { id: 'products', label: 'Productos', icon: ShoppingBag },
        { id: 'text', label: 'Texto Libre', icon: Type },
        { id: 'about', label: 'Sobre Nosotros', icon: Info },
        { id: 'mission', label: 'Misión/Visión', icon: Target },
        { id: 'contact', label: 'Contacto', icon: Phone },
        { id: 'footer', label: 'Pie de Página', icon: LayoutTemplate },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-sky-50 to-white border-b border-sky-100">
                <h2 className="text-xl font-black text-sky-900 tracking-tight flex items-center gap-2">
                    <Palette size={20} className="text-sky-500" />
                    Panel de Diseño
                </h2>
                <p className="text-xs text-sky-600/70 font-medium mt-1">
                    Arrastra, edita y personaliza tu tienda en tiempo real.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {!selectedBlock ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <PlusCircle size={14} /> Añadir Bloques
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {BLOCK_TYPES.map(type => {
                                    const Icon = type.icon;
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => onAddBlock(type.id)}
                                            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-gray-100 rounded-2xl hover:border-sky-300 hover:shadow-md hover:shadow-sky-100 transition-all group"
                                        >
                                            <Icon size={24} className="text-gray-400 group-hover:text-sky-500 transition-colors" />
                                            <span className="text-[10px] font-bold text-gray-600 text-center uppercase tracking-wider">{type.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <LayoutTemplate size={16} className="text-sky-500" />
                                Editar Bloque
                            </h3>
                            <button
                                onClick={onRemoveBlock}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Eliminar bloque"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Color de Fondo */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <PaintBucket size={14} /> Fondo
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={selectedBlock.data.backgroundColor || '#ffffff'}
                                        onChange={(e) => onUpdateBlock({ backgroundColor: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    />
                                    <input
                                        type="text"
                                        value={selectedBlock.data.backgroundColor || '#ffffff'}
                                        onChange={(e) => onUpdateBlock({ backgroundColor: e.target.value })}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono"
                                    />
                                </div>
                            </div>

                            {/* Color de Texto */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <Type size={14} /> Color de Texto
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={selectedBlock.data.textColor || '#333333'}
                                        onChange={(e) => onUpdateBlock({ textColor: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    />
                                    <input
                                        type="text"
                                        value={selectedBlock.data.textColor || '#333333'}
                                        onChange={(e) => onUpdateBlock({ textColor: e.target.value })}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <p className="text-[10px] text-gray-400 font-medium text-center italic">
                                    Haz clic directamente sobre los textos en el lienzo para editarlos.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
