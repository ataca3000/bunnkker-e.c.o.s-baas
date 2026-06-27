import React, { useState } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';
import type { BlockConfig, BlockType } from './Types';
import { SortableBlock } from './Blocks';
import SidebarBuilder from './SidebarBuilder';
import { Save, Eye, Monitor, Smartphone, Store } from 'lucide-react';

interface CanvasBuilderProps {
    initialBlocks: BlockConfig[];
    onSave: (blocks: BlockConfig[]) => Promise<void>;
}

export default function CanvasBuilder({ initialBlocks, onSave }: CanvasBuilderProps) {
    const [blocks, setBlocks] = useState<BlockConfig[]>(initialBlocks);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const addBlock = (type: BlockType) => {
        const newBlock: BlockConfig = {
            id: uuidv4(),
            type,
            data: {
                backgroundColor: '#ffffff',
                textColor: '#333333',
            }
        };
        
        // Setup initial data based on type
        if (type === 'hero') {
            newBlock.data = { ...newBlock.data, title: 'Nuevo Hero', subtitle: 'Subtítulo', mediaType: 'image', backgroundColor: '#0F172A', textColor: '#ffffff' };
        } else if (type === 'products') {
            newBlock.data = { ...newBlock.data, title: 'Productos Destacados', items: [
                { id: uuidv4(), name: 'Producto 1', price: '$99', image: '' },
                { id: uuidv4(), name: 'Producto 2', price: '$149', image: '' },
                { id: uuidv4(), name: 'Producto 3', price: '$199', image: '' }
            ]};
        }

        setBlocks([...blocks, newBlock]);
        setSelectedBlockId(newBlock.id);
    };

    const updateBlock = (id: string, newData: any) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...newData } } : b));
    };

    const removeBlock = (id: string) => {
        setBlocks(blocks.filter(b => b.id !== id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(blocks);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedBlock = blocks.find(b => b.id === selectedBlockId);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-gray-50 rounded-[32px] overflow-hidden border border-gray-200 shadow-xl">
            
            {/* Sidebar Tools */}
            {!isPreviewMode && (
                <div className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0">
                    <SidebarBuilder 
                        selectedBlock={selectedBlock}
                        onUpdateBlock={(data) => selectedBlock && updateBlock(selectedBlock.id, data)}
                        onRemoveBlock={() => selectedBlock && removeBlock(selectedBlock.id)}
                        onAddBlock={addBlock}
                    />
                </div>
            )}

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-gray-100/50">
                
                {/* Topbar */}
                <div className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-2 text-gray-500 font-bold uppercase tracking-wider text-xs">
                        <Store size={18} className="text-sky-500" />
                        <span>Constructor Web</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button 
                                onClick={() => setDevice('desktop')}
                                className={`p-2 rounded-lg transition-all ${device === 'desktop' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Monitor size={16} />
                            </button>
                            <button 
                                onClick={() => setDevice('mobile')}
                                className={`p-2 rounded-lg transition-all ${device === 'mobile' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Smartphone size={16} />
                            </button>
                        </div>

                        <button 
                            onClick={() => {
                                setIsPreviewMode(!isPreviewMode);
                                setSelectedBlockId(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isPreviewMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <Eye size={16} />
                            {isPreviewMode ? 'Modo Edición' : 'Vista Previa'}
                        </button>

                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all disabled:opacity-50"
                        >
                            <Save size={16} />
                            {isSaving ? 'Guardando...' : 'Guardar Diseño'}
                        </button>
                    </div>
                </div>

                {/* Canvas Scroll Area */}
                <div className="flex-1 overflow-y-auto p-8 flex justify-center pb-32" onClick={() => setSelectedBlockId(null)}>
                    
                    <div 
                        className={`transition-all duration-500 bg-white shadow-2xl relative ${device === 'desktop' ? 'w-full max-w-5xl rounded-3xl' : 'w-[400px] min-h-[800px] rounded-[3rem] border-[12px] border-gray-900'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {blocks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Store size={48} className="mb-4 opacity-50" />
                                <p className="font-bold text-lg">Tu lienzo está vacío</p>
                                <p className="text-sm">Agrega bloques desde el menú lateral para empezar a construir tu tienda.</p>
                            </div>
                        ) : (
                            <DndContext 
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext 
                                    items={blocks.map(b => b.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="flex flex-col w-full h-full overflow-hidden rounded-[inherit]">
                                        {blocks.map((block) => (
                                            <SortableBlock
                                                key={block.id}
                                                id={block.id}
                                                type={block.type}
                                                data={block.data}
                                                isSelected={selectedBlockId === block.id}
                                                onUpdate={(data: any) => updateBlock(block.id, data)}
                                                onSelect={setSelectedBlockId}
                                                isPreviewMode={isPreviewMode}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                </div>
            </div>

        </div>
    );
}
