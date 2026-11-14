"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer, Share2, Link as LinkIcon, Users, ShoppingBag,
  Shield, Truck, Package, CreditCard, Receipt, UserCheck,
  Sparkles, CheckCircle2, Copy, Smartphone, ExternalLink, RefreshCw,
  Trash2, Laptop, Wifi, WifiOff, ShieldAlert, KeyRound, Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import { useSyncListener } from '@/lib/syncNotifier';

interface RoleOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badgeColor: string;
}

interface PairedDeviceView {
  deviceId: string;
  label: string;
  role: string;
  userId: string;
  userName: string;
  platform: string;
  ip?: string;
  currentPath?: string;
  pendingQueueSize?: number;
  pairedAt: string;
  lastSeenAt: string;
  status: 'ONLINE' | 'OFFLINE' | 'REVOKED';
}

interface ActivePassView {
  passId: string;
  code: string;
  role: string;
  label: string;
  expiresAt: number;
  reusable: boolean;
  usedCount: number;
}

const STAFF_ROLES: RoleOption[] = [
  {
    id: 'sales',
    name: 'Cajero / Punto de Venta',
    description: 'Cobro rápido, carrito y emisión de tickets',
    icon: <CreditCard size={18} className="text-emerald-400" />,
    badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  },
  {
    id: 'inventory',
    name: 'Bodeguero / Inventario',
    description: 'Gestión de existencias, estantes y reabastecimiento',
    icon: <Package size={18} className="text-sky-400" />,
    badgeColor: 'bg-sky-500/10 border-sky-500/30 text-sky-400'
  },
  {
    id: 'carga_descarga',
    name: 'Patio / Carga y Descarga',
    description: 'Validación física de salida con foto y firma digital',
    icon: <Shield size={18} className="text-amber-400" />,
    badgeColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  },
  {
    id: 'driver',
    name: 'Chofer / Repartidor',
    description: 'Rutas de entrega y confirmación en campo',
    icon: <Truck size={18} className="text-indigo-400" />,
    badgeColor: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
  },
  {
    id: 'billing',
    name: 'Facturación / Caja Principal',
    description: 'Emisión de CFDI SAT y cortes de caja',
    icon: <Receipt size={18} className="text-purple-400" />,
    badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
  },
  {
    id: 'admin',
    name: 'Gerente de Sucursal',
    description: 'Control de operaciones, KPIs y personal local',
    icon: <UserCheck size={18} className="text-rose-400" />,
    badgeColor: 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  }
];

export default function QRGeneratorPage() {
  const { profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [baseUrl, setBaseUrl] = useState('');

  // Estado para pase seguro multidispositivo
  const [selectedRole, setSelectedRole] = useState<RoleOption>(STAFF_ROLES[0]);
  const [terminalLabel, setTerminalLabel] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState(60);
  const [reusablePass, setReusablePass] = useState(true);
  const [creatingPass, setCreatingPass] = useState(false);
  const [currentPass, setCurrentPass] = useState<ActivePassView | null>(null);
  const [currentPassToken, setCurrentPassToken] = useState<string>('');

  // Dispositivos conectados en tiempo real
  const [devices, setDevices] = useState<PairedDeviceView[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const detectIp = useCallback(() => {
    if (typeof window === 'undefined') return;
    const currentHost = window.location.hostname;
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      fetch('/api/network/ip')
        .then((res) => res.json())
        .then((data) => {
          const port = window.location.port ? `:${window.location.port}` : '';
          setBaseUrl(data?.ip ? `http://${data.ip}${port}` : window.location.origin);
        })
        .catch(() => setBaseUrl(window.location.origin));
    } else {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchPairedDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/pairing/devices', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setDevices(Array.isArray(data.devices) ? data.devices : []);
      }
    } catch {
      // ignore transient network failures
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const generateStaffPass = useCallback(
    async (roleToUse: RoleOption, customLabel?: string) => {
      setCreatingPass(true);
      try {
        const label = (customLabel || terminalLabel || `Terminal ${roleToUse.name.split('/')[0].trim()}`).trim();
        const res = await fetch('/api/pairing/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            role: roleToUse.id,
            label,
            ttlMinutes,
            reusable: reusablePass,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toast.error(data?.error || 'No se pudo generar el pase seguro.');
          return;
        }
        setCurrentPass(data.pass);
        setCurrentPassToken(data.token);
      } catch {
        toast.error('Error de conexión al generar el pase QR.');
      } finally {
        setCreatingPass(false);
      }
    },
    [terminalLabel, ttlMinutes, reusablePass]
  );

  useEffect(() => {
    detectIp();
  }, [detectIp]);

  useEffect(() => {
    if (!authLoading && profile?.role && ['superadmin', 'admin'].includes(profile.role)) {
      void fetchPairedDevices();
      if (!currentPass && !creatingPass) {
        void generateStaffPass(selectedRole);
      }
    }
  }, [authLoading, profile, fetchPairedDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  useSyncListener(() => {
    if (profile?.role && ['superadmin', 'admin'].includes(profile.role)) {
      void fetchPairedDevices();
    }
  }, ['devices']);

  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role);
    void generateStaffPass(role);
  };

  const handleRevokeDevice = async (deviceId: string, label: string) => {
    try {
      const res = await fetch(`/api/pairing/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success(`Terminal "${label}" desvinculada remotamente.`, '🔒 Desvinculada');
        void fetchPairedDevices();
      } else {
        toast.error(data?.error || 'No se pudo desvincular la terminal.');
      }
    } catch {
      toast.error('Error de red al desvincular la terminal.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="animate-spin text-sky-400" size={24} />
        <span className="text-sm font-semibold">Verificando permisos de vinculación...</span>
      </div>
    );
  }

  if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
    return <div className="p-8 text-white">No tienes permisos para ver esta página.</div>;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const clientUrl = normalizedBase ? `${normalizedBase}/?mode=client` : '';
  const staffPairUrl =
    normalizedBase && currentPassToken
      ? `${normalizedBase}/pair?token=${encodeURIComponent(currentPassToken)}`
      : '';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Encabezado Principal */}
      <header className="mb-6 print:hidden">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Share2 className="text-sky-400" size={32} />
          Ecosistema de Vinculación Multidispositivo
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-2xl">
          Genera códigos QR para mostrador de clientes o pases cifrados (sin exponer PINs) para conectar múltiples celulares, tablets y cajas en tiempo real.
        </p>

        {/* Selector de Pestañas */}
        <div className="flex flex-wrap gap-2 mt-6 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'staff'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={18} />
            Pases de Personal & Terminales ({devices.filter((d) => d.status === 'ONLINE').length})
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: CLIENTES / MOSTRADOR
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block">
          {/* Tarjeta del Código QR para Imprimir */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden print:p-0 print:border-none print:bg-white print:text-black">
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

            <div className="bg-white p-3 rounded-2xl shadow-2xl my-4 print:shadow-none print:p-0 flex items-center justify-center">
              {clientUrl ? (
                <QRCodeSVG
                  value={clientUrl}
                  size={240}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/icon-192x192.png',
                    x: undefined,
                    y: undefined,
                    height: 48,
                    width: 48,
                    excavate: true,
                  }}
                />
              ) : (
                <div className="w-60 h-60 bg-slate-200 animate-pulse rounded-xl" />
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
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 border border-slate-800 flex flex-col justify-between print:hidden">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <LinkIcon className="text-sky-400" />
                Enlace Público del Catálogo
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Edita el dominio/IP base si usas un túnel o red distinta. El enlace para clientes aísla la tienda para cero acceso al panel interno.
              </p>

              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                URL Base del Servidor
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-3">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://tu-tienda.com o http://192.168.1.10:3000"
                  className="bg-transparent border-none text-sky-300 w-full outline-none font-mono text-sm px-2 py-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={detectIp}
                    title="Re-detectar origen del servidor"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(clientUrl);
                      toast.success('Enlace copiado al portapapeles.', '✅ Copiado');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <Copy size={13} />
                    Copiar
                  </button>
                  {clientUrl && (
                    <a
                      href={clientUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <ExternalLink size={13} />
                      Abrir Link
                    </a>
                  )}
                </div>
              </div>

              <div className="text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800/80 truncate">
                Destino cliente: <span className="text-sky-400">{clientUrl}</span>
              </div>

              <div className="mt-6 p-4 bg-sky-950/30 border border-sky-500/20 rounded-xl">
                <h4 className="text-sky-400 font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={16} />
                  Aislamiento Kiosco Activo
                </h4>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Al entrar por este QR (`?mode=client`), el dispositivo queda bloqueado en modo tienda sin acceso accidental a cajas ni costos internos.
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
          TAB 2: PASES SEGUROS Y TERMINALES MULTIDISPOSITIVO
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:block">
            {/* Selector de Roles y Opciones del Pase (Lado Izquierdo) */}
            <div className="lg:col-span-6 bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-slate-800 print:hidden space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">1. Selecciona el Rol de Trabajo</h3>
                <p className="text-slate-400 text-xs mb-4">
                  El pase vincula la terminal de forma cifrada sin exponer PINs en la URL.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STAFF_ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleRoleChange(role)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        selectedRole.id === role.id
                          ? 'bg-purple-900/25 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-slate-900 rounded-xl">{role.icon}</div>
                        <span className="font-mono text-[10px] uppercase text-purple-300 font-bold">
                          {role.id}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">{role.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{role.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuración del Pase */}
              <div className="pt-4 border-t border-slate-800/80 space-y-4">
                <h3 className="text-lg font-bold text-white mb-1">2. Parámetros del Pase de Vinculación</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Etiqueta de Terminal
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Tablet Bodega Norte"
                      value={terminalLabel}
                      onChange={(e) => setTerminalLabel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Vigencia del Pase
                    </label>
                    <select
                      value={ttlMinutes}
                      onChange={(e) => setTtlMinutes(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={60}>1 hora</option>
                      <option value={480}>8 horas (Turno)</option>
                      <option value={1440}>24 horas</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-300 font-medium">
                    Permitir múltiples dispositivos con este mismo pase
                  </span>
                  <input
                    type="checkbox"
                    checked={reusablePass}
                    onChange={(e) => setReusablePass(e.target.checked)}
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  disabled={creatingPass}
                  onClick={() => void generateStaffPass(selectedRole, terminalLabel)}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {creatingPass ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  Generar Nuevo Pase & Código 6 Dígitos
                </button>
              </div>

              {/* Enlace generado */}
              {staffPairUrl && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Enlace Seguro de Vinculación (`/pair`)
                  </label>
                  <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <input
                      type="text"
                      readOnly
                      value={staffPairUrl}
                      className="bg-transparent text-purple-300 w-full outline-none font-mono text-xs truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(staffPairUrl);
                        toast.success('Enlace seguro copiado.', '✅ Copiado');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold whitespace-nowrap"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Gafete / Pase Imprimible (Lado Derecho) */}
            <div className="lg:col-span-6 bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden print:p-0 print:border-none print:bg-white print:text-black">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 print:hidden" />

              <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-purple-500/30 rounded-2xl p-5 shadow-2xl flex flex-col items-center print:border-2 print:border-black print:bg-white print:shadow-none">
                <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3 mb-4 print:border-black">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center font-black text-white text-xs">
                      B
                    </div>
                    <span className="font-extrabold text-xs tracking-wider uppercase text-white print:text-black">
                      BUNKKER E.C.O.S.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase print:text-black">
                    PASE CIFRADO
                  </span>
                </div>

                <div className="text-center mb-3">
                  <h3 className="text-lg font-black text-white print:text-black">
                    {currentPass?.label || selectedRole.name}
                  </h3>
                  <span
                    className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold border ${selectedRole.badgeColor} print:border-black print:text-black`}
                  >
                    {selectedRole.name}
                  </span>
                </div>

                {/* QR del Pase */}
                <div className="bg-white p-4 rounded-xl shadow-xl my-2 flex items-center justify-center print:shadow-none print:p-0">
                  {staffPairUrl ? (
                    <QRCodeSVG
                      value={staffPairUrl}
                      size={200}
                      level="H"
                      includeMargin={true}
                      imageSettings={{
                        src: '/icon-192x192.png',
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                      }}
                    />
                  ) : (
                    <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-xl" />
                  )}
                </div>

                {/* Código manual de 6 dígitos */}
                {currentPass?.code && (
                  <div className="w-full mt-3 bg-slate-900/90 border border-purple-500/30 rounded-xl p-3 text-center print:bg-slate-100 print:border-black">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 block print:text-black">
                      Código Manual (`/pair`)
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-2xl font-mono font-black tracking-[0.25em] text-purple-300 print:text-black">
                        {currentPass.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentPass.code);
                          toast.success('Código de 6 dígitos copiado.', '✅ Copiado');
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 print:hidden"
                        title="Copiar código"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[10px] mt-3 text-center text-slate-500 print:text-slate-600">
                  Escanea el QR o abre `/pair` e ingresa el código para vincular la terminal.
                </p>
              </div>

              <div className="mt-6 w-full max-w-sm print:hidden">
                <button
                  onClick={handlePrint}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  Imprimir Credencial / Pase
                </button>
              </div>
            </div>
          </div>

          {/* ── PANEL EN VIVO: TERMINALES VINCULADAS MULTIDISPOSITIVO ── */}
          <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-6 border border-slate-800 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Laptop size={20} className="text-sky-400" />
                  Terminales Vinculadas en Vivo ({devices.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Monitorea cada teléfono, tablet o computadora conectada y desvincula dispositivos al instante si es necesario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchPairedDevices()}
                disabled={loadingDevices}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
              >
                <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} />
                Actualizar Lista
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                Aún no hay terminales adicionales vinculadas. Escanea el código QR superior desde otro dispositivo para conectarlo aquí.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((dev) => {
                  const isOnline = dev.status === 'ONLINE';
                  const isRevoked = dev.status === 'REVOKED';
                  return (
                    <div
                      key={dev.deviceId}
                      className={`rounded-xl p-4 border flex flex-col justify-between gap-3 ${
                        isRevoked
                          ? 'bg-red-950/20 border-red-500/25 opacity-75'
                          : isOnline
                            ? 'bg-slate-950/80 border-emerald-500/30'
                            : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-white">{dev.label}</div>
                            <div className="text-[11px] text-slate-400">
                              {dev.userName} · <span className="uppercase font-mono text-purple-300">{dev.role}</span>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isRevoked
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                : isOnline
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {isRevoked ? <ShieldAlert size={11} /> : isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                            {dev.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono space-y-0.5 pt-1">
                          <div>Plataforma: {dev.platform}</div>
                          {dev.ip && <div>IP: {dev.ip}</div>}
                          {dev.currentPath && <div>Vista: {dev.currentPath}</div>}
                          {(dev.pendingQueueSize ?? 0) > 0 && (
                            <div className="text-amber-400 font-bold">
                              Cola offline pendiente: {dev.pendingQueueSize}
                            </div>
                          )}
                          <div>
                            Último pulso: {new Date(dev.lastSeenAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => void handleRevokeDevice(dev.deviceId, dev.label)}
                          className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Trash2 size={13} />
                          Desvincular Terminal
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estilos para impresión de gafetes y carteles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />
    </div>
  );
}
