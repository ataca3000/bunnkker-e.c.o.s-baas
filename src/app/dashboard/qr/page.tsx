"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Printer, Share2, Link as LinkIcon, Users, ShoppingBag, 
  Shield, Truck, Package, CreditCard, Receipt, UserCheck, 
  Sparkles, CheckCircle2, Copy, Smartphone, ExternalLink, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';

interface RoleOption {
  id: string;
  name: string;
  description: string;
  defaultPin: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const STAFF_ROLES: RoleOption[] = [
  {
    id: 'sales',
    name: 'Cajero / Punto de Venta',
    description: 'Cobro rápido, carrito y emisión de tickets',
    defaultPin: '2222',
    icon: <CreditCard size={18} className="text-emerald-400" />,
    badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  },
  {
    id: 'inventory',
    name: 'Bodeguero / Inventario',
    description: 'Gestión de existencias, estantes y reabastecimiento',
    defaultPin: '3333',
    icon: <Package size={18} className="text-sky-400" />,
    badgeColor: 'bg-sky-500/10 border-sky-500/30 text-sky-400'
  },
  {
    id: 'carga_descarga',
    name: 'Patio / Carga y Descarga',
    description: 'Validación física de salida con foto y firma digital',
    defaultPin: '6666',
    icon: <Shield size={18} className="text-amber-400" />,
    badgeColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  },
  {
    id: 'driver',
    name: 'Chofer / Repartidor',
    description: 'Rutas de entrega y confirmación en campo',
    defaultPin: '5555',
    icon: <Truck size={18} className="text-indigo-400" />,
    badgeColor: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
  },
  {
    id: 'billing',
    name: 'Facturación / Caja Principal',
    description: 'Emisión de CFDI SAT y cortes de caja',
    defaultPin: '7777',
    icon: <Receipt size={18} className="text-purple-400" />,
    badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
  },
  {
    id: 'admin',
    name: 'Gerente de Sucursal',
    description: 'Control de operaciones, KPIs y personal local',
    defaultPin: '1111',
    icon: <UserCheck size={18} className="text-rose-400" />,
    badgeColor: 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  }
];

export default function QRGeneratorPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [baseUrl, setBaseUrl] = useState('');
  
  // Estado para pase de personal
  const [selectedRole, setSelectedRole] = useState<RoleOption>(STAFF_ROLES[0]);
  const [staffPin, setStaffPin] = useState(STAFF_ROLES[0].defaultPin);
  const [employeeName, setEmployeeName] = useState('');

  const detectIp = () => {
    if (typeof window !== 'undefined') {
      const currentHost = window.location.hostname;
      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        fetch('/api/network/ip')
          .then(res => res.json())
          .then(data => {
            const port = window.location.port ? `:${window.location.port}` : '';
            setBaseUrl(`http://${data.ip}${port}`);
          })
          .catch(() => setBaseUrl(window.location.origin));
      } else {
        setBaseUrl(window.location.origin);
      }
    }
  };

  useEffect(() => {
    detectIp();
  }, []);

  // Cambiar rol y actualizar PIN por defecto
  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role);
    setStaffPin(role.defaultPin);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
    return <div className="p-8 text-white">No tienes permisos para ver esta página.</div>;
  }

  // URLs dinámicas
  const clientUrl = baseUrl ? `${baseUrl}/?mode=client` : '';
  const staffUrl = baseUrl ? `${baseUrl}/login?role=${selectedRole.id}&pin=${staffPin}&auto=true` : '';
  const activeQrUrl = activeTab === 'clients' ? clientUrl : staffUrl;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Encabezado Principal */}
      <header className="mb-6 print:hidden">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Share2 className="text-sky-400" size={32} />
          Ecosistema de Vinculación por Código QR
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-2xl">
          Genera códigos QR específicos según el público: códigos limpios para el mostrador de clientes y pases de acceso instantáneo por rol para el personal operativo.
        </p>

        {/* Selector de Pestañas */}
        <div className="flex gap-2 mt-6 p-1 bg-slate-900 border border-slate-800 rounded-[5px] w-fit">
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'clients'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag size={18} />
            Para Clientes (Mostrador)
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'staff'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={18} />
            Pases de Personal (Por Rol)
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: CLIENTES / MOSTRADOR
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block">
          {/* Tarjeta del Código QR para Imprimir */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-[5px] p-8 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden print:p-0 print:border-none print:bg-white print:text-black">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-sky-500 to-blue-500 print:hidden" />
            
            <div className="text-center mb-4">
              <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider print:hidden">
                Catálogo Digital
              </span>
              <h2 className="text-2xl font-black text-white mt-2 print:text-black print:text-3xl">
                ¡Ordena desde tu Celular!
              </h2>
              <p className="text-slate-400 text-sm mt-1 print:text-slate-600">
                Escanea el código con tu cámara para ver productos y precios en vivo.
              </p>
            </div>

            <div className="bg-white p-[8px] rounded-[5px] shadow-2xl my-4 print:shadow-none print:p-0 flex items-center justify-center">
              {clientUrl ? (
                <QRCodeSVG 
                  value={clientUrl} 
                  size={240} 
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: "/icon-192x192.png",
                    x: undefined,
                    y: undefined,
                    height: 48,
                    width: 48,
                    excavate: true,
                  }}
                />
              ) : (
                <div className="w-60 h-60 bg-slate-200 animate-pulse rounded-[5px]"></div>
              )}
            </div>
            
            <div className="text-center max-w-sm">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-6 print:text-slate-700">
                <Smartphone size={14} className="text-sky-400" />
                <span>Compatible con Android, iPhone y tablets sin instalar nada previo.</span>
              </div>

              <button 
                onClick={handlePrint}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 print:hidden"
              >
                <Printer size={18} />
                Imprimir Cartel de Mostrador
              </button>
            </div>
          </div>

          {/* Configuración y Enlace Directo */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-[5px] p-8 border border-slate-800 flex flex-col justify-between print:hidden">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <LinkIcon className="text-sky-400" />
                Enlace Público del Catálogo
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                Este enlace puede compartirse en redes sociales, WhatsApp o tarjetas de presentación. Los clientes entran al modo tienda con seguridad total (cero acceso a paneles internos).
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950 p-3 rounded-[5px] border border-slate-800">
                <input 
                  type="text" 
                  value={clientUrl}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\/?\??mode=client|\/catalogo/g, '');
                    setBaseUrl(raw);
                  }}
                  className="bg-transparent border-none text-sky-300 w-full outline-none font-mono text-sm px-2 py-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={detectIp}
                    title="Re-detectar IP local del servidor"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(clientUrl);
                      toast.success('Enlace copiado al portapapeles.', '✅ Copiado');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <Copy size={13} />
                    Copiar
                  </button>
                  <button 
                    onClick={() => window.open(clientUrl, '_blank')}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <ExternalLink size={13} />
                    Abrir Link
                  </button>
                </div>
              </div>

              <div className="mt-8 p-[8px] bg-sky-950/30 border border-sky-500/20 rounded-[5px]">
                <h4 className="text-sky-400 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={16} />
                  Beneficio Operativo
                </h4>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Cuando hay fila en mostrador, los clientes escanean este código, ven el catálogo completo en su propio teléfono y al llegar a caja ya tienen lista su lista de compra o pedido.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800/80 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Protección activa: El catálogo oculta costos de compra y datos fiscales.</span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: PASES DE PERSONAL (POR ROL)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:block">
          {/* Selector de Roles y Datos (Lado Izquierdo) */}
          <div className="lg:col-span-6 bg-slate-900/60 backdrop-blur-md rounded-[5px] p-[8px] md:p-8 border border-slate-800 print:hidden space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">1. Selecciona el Rol de Trabajo</h3>
              <p className="text-slate-400 text-xs mb-4">El QR configurará el dispositivo con los permisos correspondientes.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STAFF_ROLES.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleChange(role)}
                    className={`p-3 rounded-[5px] border text-left transition-all flex flex-col justify-between ${
                      selectedRole.id === role.id
                        ? 'bg-purple-900/25 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-slate-900 rounded-xl">{role.icon}</div>
                      <span className="font-mono text-xs text-slate-500 font-bold">PIN: {role.defaultPin}</span>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{role.name}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{role.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Configuración de PIN y Nombre */}
            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <h3 className="text-lg font-bold text-white mb-1">2. Credenciales del Pase</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Nombre del Operador (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    PIN de Acceso Rápido
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={staffPin}
                    onChange={(e) => setStaffPin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Enlace generado */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Enlace del Pase de Acceso
              </label>
              <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <input
                  type="text"
                  readOnly
                  value={staffUrl}
                  className="bg-transparent text-purple-300 w-full outline-none font-mono text-xs truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(staffUrl);
                    toast.success('Pase copiado al portapapeles.', '✅ Copiado');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold whitespace-nowrap"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>

          {/* Gafete / Pase Imprimible (Lado Derecho) */}
          <div className="lg:col-span-6 bg-slate-900/80 backdrop-blur-md rounded-[5px] p-8 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden print:p-0 print:border-none print:bg-white print:text-black">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 print:hidden" />

            {/* Contenedor tipo Credencial */}
            <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-[5px] p-[8px] shadow-2xl flex flex-col items-center print:border-2 print:border-black print:bg-white print:shadow-none">
              <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3 mb-4 print:border-black">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center font-black text-white text-xs">
                    B
                  </div>
                  <span className="font-extrabold text-xs tracking-wider uppercase text-white print:text-black">BUNKKER E.C.O.S.</span>
                </div>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase print:text-black">PASE DE ACCESO</span>
              </div>

              <div className="text-center mb-3">
                <h3 className="text-lg font-black text-white print:text-black">
                  {employeeName ? employeeName : selectedRole.name}
                </h3>
                <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold border ${selectedRole.badgeColor} print:border-black print:text-black`}>
                  {selectedRole.name}
                </span>
              </div>

              {/* QR del Pase */}
              <div className="bg-white p-4 rounded-[5px] shadow-xl my-2 flex items-center justify-center print:shadow-none print:p-0">
                {staffUrl ? (
                  <QRCodeSVG 
                    value={staffUrl} 
                    size={200} 
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: "/icon-192x192.png",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                ) : (
                  <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-xl"></div>
                )}
              </div>

              <div className="text-center text-xs text-slate-400 mt-3 print:text-slate-700">
                <p className="font-mono text-xs">PIN: <strong className="text-white print:text-black">{staffPin}</strong></p>
                <p className="text-[10px] mt-1 text-slate-500 print:text-slate-600">
                  Escanea para auto-autenticar e instalar la terminal en el celular.
                </p>
              </div>
            </div>

            <div className="mt-6 w-full max-w-sm print:hidden">
              <button
                onClick={handlePrint}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                Imprimir Credencial / Gafete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos para impresión de gafetes y carteles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            visibility: visible;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 100vw;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .print\\:block * {
            visibility: visible;
          }
        }
      `}} />
    </div>
  );
}

