import { useDroppable } from '@dnd-kit/core';
import { Trash2, AlertOctagon } from 'lucide-react';

export default function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'inventory-trash' });

  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-8 right-8 z-[120] flex items-center gap-3 px-6 py-4 rounded-full border-2 shadow-2xl transition-all duration-200 select-none backdrop-blur-xl ${
        isOver
          ? 'border-red-400 bg-red-600 text-white scale-110 shadow-[0_0_35px_rgba(239,68,68,0.7)] animate-pulse'
          : 'border-red-500/40 bg-slate-950/90 text-red-300 hover:border-red-400/80 hover:bg-slate-900/95 shadow-[0_10px_25px_rgba(0,0,0,0.6)]'
      }`}
      aria-label="Papelera de reciclaje. Suelta aquí un producto para archivarlo o eliminarlo."
      title="Bote de basura: Arrastra cualquier tarjeta de producto aquí para darlo de baja"
    >
      <div className={`p-2 rounded-full transition-colors ${isOver ? 'bg-white text-red-600' : 'bg-red-500/20 text-red-400'}`}>
        {isOver ? <AlertOctagon size={22} className="animate-bounce" /> : <Trash2 size={20} />}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-black uppercase tracking-wider">
          {isOver ? '¡SOLTAR PARA ELIMINAR!' : 'Bote de Basura'}
        </span>
        <span className="text-[10px] text-red-300/80 font-medium">
          {isOver ? 'Se dará de baja del almacén' : 'Arrastra aquí para descartar tarjeta'}
        </span>
      </div>
    </div>
  );
}

