import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';

export default function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'inventory-trash' });

  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-6 right-6 z-[120] flex items-center gap-3 border px-5 py-4 shadow-2xl transition-colors ${
        isOver
          ? 'border-red-400 bg-red-600 text-white scale-105'
          : 'border-red-500/50 bg-slate-950/95 text-red-300'
      }`}
      aria-label="Papelera de reciclaje. Suelta aquí un producto para archivarlo."
    >
      <Trash2 size={22} />
      <span className="text-xs font-black uppercase tracking-wider">Arrastra aquí para reciclar</span>
    </div>
  );
}
