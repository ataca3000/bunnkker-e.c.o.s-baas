import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import { storage } from '@bunkker/core';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export function EditableText({ value, onChange, isPreviewMode, className, style, tagName = 'div' }: any) {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleBlur = (e: any) => {
    if (e.target.innerText !== value) {
      onChange(e.target.innerText);
    }
  };

  const Tag = tagName as any;

  if (isPreviewMode) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  return (
    <Tag
      className={`outline-none border-b-2 border-transparent hover:border-gray-400 focus:border-blue-500 transition-colors cursor-text focus:bg-white/10 ${className}`}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onBlur={handleBlur}
      style={style}
    >
      {internalValue}
    </Tag>
  );
}

export function ImageUploader({ onUpload, isPreviewMode, className, children }: any) {
  const [isUploading, setIsUploading] = useState(false);

  if (isPreviewMode) return <div className={className}>{children}</div>;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const fileRef = ref(storage, `store-builder/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);
        
        uploadTask.on('state_changed', 
            null, 
            (error: Error) => {
                console.error("Error subiendo archivo:", error);
                setIsUploading(false);
            }, 
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                onUpload(url, type);
                setIsUploading(false);
            }
        );
    } catch (err) {
        console.error(err);
        setIsUploading(false);
    }
  };

  return (
    <div className={`relative group/image ${className || ''}`}>
      {children}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center z-20 rounded-xl">
        <label className="bg-white text-gray-800 text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-100 shadow-sm font-medium flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          {isUploading ? 'Subiendo...' : 'Cambiar Imagen'}
          <input 
            type="file" 
            accept="image/*,video/*"
            onClick={(e) => { e.stopPropagation(); }}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
}

export function HeaderBlock({ id, data, onUpdate, isPreviewMode }: any) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || 'transparent', padding: data.padding || '24px 16px', minHeight: data.minHeight || 'auto', width: data.width || '100%', margin: '0 auto' }}>
      <div className="flex justify-between items-center border-b border-gray-200/20 pb-2">
        <EditableText
          value={data.logoText || 'Logo'}
          onChange={(val: string) => onUpdate({ logoText: val })}
          isPreviewMode={isPreviewMode}
          className="text-2xl font-bold tracking-tighter"
          style={{ color: data.textColor || '#0ea5e9' }}
        />
        {data.showCart && (
          <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <ShoppingCart size={data.iconSize ? parseInt(data.iconSize) : 24} style={{ color: data.iconColor || '#333' }} />
          </button>
        )}
      </div>
    </div>
  );
}

export function HeroBlock({ id, data, onUpdate, isPreviewMode }: any) {
  const isVideo = data.mediaType === 'video';
  const hasMedia = !!data.mediaUrl;

  return (
    <ImageUploader 
      onUpload={(url: string, type: string) => onUpdate({ mediaUrl: url, mediaType: type })}
      isPreviewMode={isPreviewMode}
    >
      <div 
        className="relative flex items-center justify-center overflow-hidden rounded-[2rem] shadow-2xl group mx-4 my-2"
        style={{ backgroundColor: data.backgroundColor || '#0F172A', minHeight: data.minHeight || '500px', width: data.width || 'auto' }}
      >
        {hasMedia && (
          isVideo ? (
             <video src={data.mediaUrl} className="absolute inset-0 w-full h-full object-cover z-0" autoPlay loop muted playsInline />
          ) : (
            <img src={data.mediaUrl} alt="Hero" className="absolute inset-0 w-full h-full object-cover z-0" />
          )
        )}
        
        {hasMedia && <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none backdrop-blur-[2px]"></div>}
        
        <div className={`relative z-20 text-center px-6 max-w-4xl mx-auto flex flex-col items-center justify-center w-full h-full`}>
          <EditableText
            tagName="h1"
            value={data.title || 'Bienvenidos'}
            onChange={(val: string) => onUpdate({ title: val })}
            isPreviewMode={isPreviewMode}
            className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-lg tracking-tight"
            style={{ color: data.textColor || '#ffffff' }}
          />
          <EditableText
            tagName="p"
            value={data.subtitle || 'La mejor tienda en línea.'}
            onChange={(val: string) => onUpdate({ subtitle: val })}
            isPreviewMode={isPreviewMode}
            className="text-xl md:text-2xl drop-shadow-md max-w-2xl opacity-90 font-light"
            style={{ color: data.textColor || '#ffffff' }}
          />
        </div>
      </div>
    </ImageUploader>
  );
}

export function ProductsBlock({ id, data, onUpdate, isPreviewMode }: any) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || 'transparent', padding: data.padding || '64px 16px', minHeight: data.minHeight || 'auto', width: data.width || '100%', margin: '0 auto' }}>
      <div className="max-w-7xl mx-auto">
        <EditableText
          tagName="h2"
          value={data.title || 'Nuestros Productos'}
          onChange={(val: string) => onUpdate({ title: val })}
          isPreviewMode={isPreviewMode}
          className="text-3xl font-bold text-center mb-12 tracking-tight"
          style={{ color: data.textColor || '#333' }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.items?.map((item: any, idx: number) => (
            <div key={item.id} className="bg-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-white/20 group cursor-pointer relative">
              <ImageUploader
                onUpload={(url: string) => {
                  const newItems = [...data.items];
                  newItems[idx].image = url;
                  onUpdate({ items: newItems });
                }}
                isPreviewMode={isPreviewMode}
                className="w-full h-full"
              >
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">Sin Imagen</div>
                  )}
                </div>
              </ImageUploader>
              
              <div className="p-6 text-center">
                <EditableText
                  tagName="h3"
                  value={item.name}
                  onChange={(val: string) => {
                    const newItems = [...data.items];
                    newItems[idx].name = val;
                    onUpdate({ items: newItems });
                  }}
                  isPreviewMode={isPreviewMode}
                  className="text-lg font-semibold mb-2"
                  style={{ color: data.textColor || '#333' }}
                />
                <EditableText
                  tagName="p"
                  value={item.price}
                  onChange={(val: string) => {
                    const newItems = [...data.items];
                    newItems[idx].price = val;
                    onUpdate({ items: newItems });
                  }}
                  isPreviewMode={isPreviewMode}
                  className="font-bold text-2xl inline-block"
                  style={{ color: data.primaryColor || '#0ea5e9' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TextBlock({ id, data, onUpdate, isPreviewMode }: any) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || 'transparent', padding: data.padding || '64px 16px', minHeight: data.minHeight || 'auto', width: data.width || '100%', margin: '0 auto' }}>
       <div className="max-w-4xl mx-auto text-lg leading-relaxed" style={{ color: data.textColor || '#333', textAlign: data.align || 'left' }}>
         <EditableText
           value={data.content || 'Escribe tu texto aquí...'}
           onChange={(val: string) => onUpdate({ content: val })}
           isPreviewMode={isPreviewMode}
         />
       </div>
    </div>
  );
}

export function AboutBlock({ id, data, onUpdate, isPreviewMode }: any) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || 'transparent', padding: data.padding || '64px 16px', minHeight: data.minHeight || 'auto', width: data.width || '100%', margin: '0 auto' }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm shadow-xl">
        <div className="flex-1 w-full">
           <ImageUploader 
              onUpload={(url: string) => onUpdate({ image: url })}
              isPreviewMode={isPreviewMode}
              className="w-full aspect-video rounded-2xl overflow-hidden bg-gray-100/10 border border-white/10 shadow-lg"
           >
             {data.image ? (
               <img src={data.image} alt="About Us" className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-400">Añadir Imagen</div>
             )}
           </ImageUploader>
        </div>
        <div className="flex-1">
          <EditableText
            tagName="h2"
            value={data.title || 'Nosotros'}
            onChange={(val: string) => onUpdate({ title: val })}
            isPreviewMode={isPreviewMode}
            className="text-4xl font-bold mb-6 tracking-tight"
            style={{ color: data.textColor || '#333' }}
          />
          <EditableText
            tagName="p"
            value={data.content || 'Nuestra historia...'}
            onChange={(val: string) => onUpdate({ content: val })}
            isPreviewMode={isPreviewMode}
            className="text-lg leading-relaxed opacity-90"
            style={{ color: data.textColor || '#444' }}
          />
        </div>
      </div>
    </div>
  );
}

export function BlockRenderer({ id, type, data, onUpdate, isPreviewMode }: any) {
  const props = { id, data, onUpdate, isPreviewMode };
  switch (type) {
    case 'header': return <HeaderBlock {...props} />;
    case 'hero': return <HeroBlock {...props} />;
    case 'products': return <ProductsBlock {...props} />;
    case 'text': return <TextBlock {...props} />;
    case 'about': return <AboutBlock {...props} />;
    default: return <div className="p-4 bg-red-100 text-red-600 rounded">Block Desconocido: {type}</div>;
  }
}

export function SortableBlock({ id, type, data, isSelected, onUpdate, onSelect, isPreviewMode }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative group sortable-block-wrapper ${isDragging ? 'opacity-50 scale-95' : ''} transition-transform duration-200`}
    >
      {!isPreviewMode && (
        <div className={`absolute -inset-2 border-2 rounded-2xl pointer-events-none transition-colors z-30 ${isSelected ? 'border-sky-500' : 'border-transparent group-hover:border-sky-300/50'}`}></div>
      )}
      
      {/* Drag handle */}
      {!isPreviewMode && (
        <div 
          {...attributes} 
          {...listeners}
          className={`absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-lg cursor-grab opacity-0 group-hover:opacity-100 transition-opacity z-40 active:cursor-grabbing ${isSelected && 'opacity-100'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </div>
      )}

      <div onClick={() => !isPreviewMode && onSelect(id)} className="w-full relative">
        <BlockRenderer id={id} type={type} data={data} onUpdate={onUpdate} isPreviewMode={isPreviewMode} />
      </div>
    </div>
  );
}
