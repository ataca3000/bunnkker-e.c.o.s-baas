"use client";

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useCart } from '@/context/CartContext';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Check,
  Eye,
  FileText,
  Building2,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  Layout,
  Receipt
} from 'lucide-react';
import { toast } from '@/lib/toast';

export default function LogoUploader() {
  const { siteConfig, updateSiteConfig } = useCart();
  const [logoUrl, setLogoUrl] = useState<string>(siteConfig.logoUrl || '');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [showUrlField, setShowUrlField] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection and conversion to base64 Data URL
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera el tamaño máximo permitido de 5MB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (result) {
        setLogoUrl(result);
        try {
          await updateSiteConfig({
            ...siteConfig,
            logoUrl: result,
          });
          toast.success('¡Logo de empresa actualizado exitosamente!', '✅ Logo de Marca');
        } catch (err) {
          console.error("Error actualizando logo", err);
          toast.error('Ocurrió un error al guardar el logo.');
        }
      }
      setIsUploading(false);
    };

    reader.onerror = () => {
      toast.error('No se pudo leer el archivo de imagen.');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveUrl = async () => {
    if (!customUrlInput.trim()) return;
    setIsUploading(true);
    try {
      setLogoUrl(customUrlInput.trim());
      await updateSiteConfig({
        ...siteConfig,
        logoUrl: customUrlInput.trim(),
      });
      setShowUrlField(false);
      setCustomUrlInput('');
      toast.success('¡Logo actualizado desde enlace URL!', '✅ Logo de Marca');
    } catch {
      toast.error('No se pudo guardar la URL del logo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploading(true);
    try {
      setLogoUrl('');
      await updateSiteConfig({
        ...siteConfig,
        logoUrl: '',
      });
      toast.info('Logo eliminado. Se usará el logotipo de texto por defecto.', 'ℹ️ Logo Removido');
    } catch {
      toast.error('Error al remover el logo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Logo Corporativo y Marca
              {logoUrl && (
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Activo
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Sube el logo de tu negocio. Se mostrará automáticamente en la barra de navegación y en las facturas/tickets PDF emitidos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Cargar / Editar
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Vistas Previas
          </button>
        </div>
      </div>

      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* File Drag and Drop Box */}
          <div className="md:col-span-2 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden group ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : 'border-slate-700 hover:border-cyan-500/50 bg-slate-950/60 hover:bg-slate-950'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/10">
                <Upload className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  Haz clic para seleccionar o arrastra aquí la imagen de tu logo
                </p>
                <p className="text-xs text-slate-400">
                  Formatos soportados: PNG, JPG, WebP o SVG (Recomendado fondo transparente, máx. 5MB)
                </p>
              </div>

              <button
                type="button"
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl border border-cyan-500/30 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Examinar Archivos
              </button>
            </div>

            {/* URL input toggle */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>¿Tienes la imagen alojada en un servidor externo?</span>
              <button
                onClick={() => setShowUrlField(!showUrlField)}
                className="text-cyan-400 hover:underline font-bold flex items-center gap-1"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {showUrlField ? 'Ocultar campo URL' : 'Ingresar enlace URL directa'}
              </button>
            </div>

            {showUrlField && (
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 animate-fadeIn">
                <input
                  type="text"
                  placeholder="https://ejemplo.com/logo-empresa.png"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none px-2"
                />
                <button
                  onClick={handleSaveUrl}
                  disabled={!customUrlInput.trim() || isUploading}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-40 transition-colors"
                >
                  Guardar URL
                </button>
              </div>
            )}
          </div>

          {/* Current Logo Display Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col items-center justify-between h-full">
            <div className="w-full text-center space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Logo Actual Guardado
              </span>
              <p className="text-[11px] text-slate-500">
                Aparece en Navbar y Facturación
              </p>
            </div>

            <div className="w-full h-36 bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-center relative overflow-hidden group">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo Corporativo"
                  className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="text-center text-slate-600 space-y-2">
                  <Building2 className="w-10 h-10 mx-auto opacity-30" />
                  <span className="text-xs font-medium block">Sin logo configurado</span>
                </div>
              )}
            </div>

            {logoUrl ? (
              <div className="w-full flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Cambiar
                </button>
                <button
                  onClick={handleRemoveLogo}
                  disabled={isUploading}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition-colors"
                  title="Eliminar logo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 text-center italic">
                Sube una imagen para ver la previsualización del isotipo o logotipo de tu marca.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {activeTab === 'preview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Navbar Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Layout className="w-4 h-4" />
                1. Vista Previa en la Barra de Navegación (Navbar)
              </span>
              <span className="text-[11px] text-slate-500">Muestra en directo</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo Tienda"
                      className="h-10 w-auto max-w-[140px] object-contain rounded-lg shadow-sm border border-cyan-500/20"
                    />
                  ) : (
                    <div className="flex items-center gap-1 font-black text-xl text-white">
                      <span className="text-blue-500">B</span>
                      <span className="text-cyan-400">UNKKER</span>
                      <span className="text-indigo-400 text-xs">.ECOS</span>
                    </div>
                  )}
                  <div className="border-l border-slate-800 pl-3 hidden sm:block">
                    <span className="text-xs font-black text-slate-200 block uppercase">
                      {siteConfig.businessName || 'BUNKKER E.C.O.S ERP'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold block">
                      Tienda Oficial & Catálogo
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold border border-slate-700">
                    Buscar productos...
                  </span>
                  <span className="bg-cyan-500 text-slate-950 text-xs px-3 py-1.5 rounded-lg font-bold shadow">
                    Carrito (0)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice PDF Header Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Receipt className="w-4 h-4" />
                2. Vista Previa en Encabezado de Facturas y Comprobantes PDF
              </span>
              <span className="text-[11px] text-slate-500">Formato CFDI / Ticket</span>
            </div>

            <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl p-6 shadow-2xl max-w-2xl mx-auto font-sans">
              <div className="flex items-start justify-between pb-4 border-b border-slate-300">
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo Factura"
                      className="h-14 w-auto max-w-[180px] object-contain"
                    />
                  ) : (
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-black text-lg uppercase tracking-tight">
                      {siteConfig.businessName || 'LOGOTIPO EMPRESA'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-black text-slate-950 uppercase">
                      {siteConfig.businessName || 'BUNKKER E.C.O.S. S.A. DE C.V.'}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      {siteConfig.businessAddress || 'Av. Principal #123, Col. Centro, México'}
                    </p>
                    <p className="text-xs text-slate-600 font-medium">
                      Tel: {siteConfig.businessPhone || '+52 241 123 4567'} • RFC: ECOS240916ABC
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="bg-cyan-100 text-cyan-800 text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase block mb-1">
                    FACTURA FISCAL CFDI 4.0
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 block">
                    FOLIO: F-2026-0042
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Fecha: 16/09/2026
                  </span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-xs text-slate-500 italic">
                <span>* El logo arriba se integrará automáticamente al descargar el archivo PDF.</span>
                <span className="font-bold text-slate-700">Muestra de Impresión</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
