"use client";

import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  FileText, 
  Globe,
  Settings,
  ShieldCheck,
  QrCode,
  CheckSquare
} from 'lucide-react';

interface ModuleNode {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  x: number;
  y: number;
  description: string;
}

interface Connection {
  from: string;
  to: string;
}

interface InteractiveTerraMapProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function InteractiveTerraMap({ value, onChange }: InteractiveTerraMapProps) {
  // Nodos de los módulos en el mapa Terraform
  const nodes: ModuleNode[] = [
    { id: 'sales', label: 'Caja POS', icon: ShoppingCart, x: 150, y: 200, description: 'Punto de venta y cobro rápido' },
    { id: 'inventory', label: 'Carga/Almacén', icon: Package, x: 400, y: 70, description: 'Control de stock e inventario' },
    { id: 'delivery', label: 'Repartidores', icon: Truck, x: 400, y: 330, description: 'Logística de envíos y repartos' },
    { id: 'crm', label: 'Clientes CRM', icon: Users, x: 650, y: 200, description: 'Fidelización y control de clientes' },
    { id: 'billing', label: 'Factura SAT', icon: FileText, x: 400, y: 200, description: 'Generación de CFDIs encriptados' },
    { id: 'design', label: 'Branding UI', icon: Settings, x: 260, y: 110, description: 'Temas visuales y personalización' },
    { id: 'marketing', label: 'Marketing QR', icon: QrCode, x: 540, y: 110, description: 'Cupones y códigos de marketing' },
    { id: 'audit', label: 'Auditoría', icon: ShieldCheck, x: 260, y: 290, description: 'Bitácora de seguridad y logs' },
    { id: 'tests', label: 'Pruebas QA', icon: CheckSquare, x: 540, y: 290, description: 'Laboratorio de testing local' },
  ];

  // Conexiones de red entre módulos para dibujar las rutas
  const connections: Connection[] = [
    { from: 'sales', to: 'inventory' },
    { from: 'sales', to: 'delivery' },
    { from: 'sales', to: 'billing' },
    { from: 'sales', to: 'design' },
    { from: 'sales', to: 'audit' },
    { from: 'inventory', to: 'crm' },
    { from: 'billing', to: 'crm' },
    { from: 'delivery', to: 'crm' },
    { from: 'design', to: 'inventory' },
    { from: 'marketing', to: 'crm' },
    { from: 'inventory', to: 'marketing' },
    { from: 'audit', to: 'delivery' },
    { from: 'billing', to: 'marketing' },
    { from: 'delivery', to: 'tests' },
    { from: 'tests', to: 'crm' }
  ];

  const toggleModule = (id: string) => {
    if (id === 'sales') return; // Caja POS es obligatoria
    const current = [...value];
    if (current.includes(id)) {
      onChange(current.filter(x => x !== id));
    } else {
      onChange([...current, id]);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 text-slate-200">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe className="text-cyan-400 animate-pulse" />
          Rutas de Activación: Terra Map
        </h3>
        <p className="text-sm text-slate-400">
          Haz clic sobre los nodos del mapa para conectar y enraizar los módulos activos de tu entorno `.terra`.
        </p>
      </div>

      {/* Mapa SVG Interactivo */}
      <div className="relative border border-slate-800/80 rounded-xl bg-slate-950/40 overflow-hidden flex justify-center items-center py-6">
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 800 400" 
          className="max-w-[800px] select-none"
        >
          {/* Definiciones para filtros de resplandor (Glow) */}
          <defs>
            <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Renderizado de Líneas de Conexión */}
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            // La conexión se ilumina si ambos extremos están activos en la licencia
            const fromActive = value.includes(conn.from);
            const toActive = value.includes(conn.to);
            const isActive = fromActive && toActive;

            return (
              <g key={`link-${idx}`}>
                {/* Línea base oscura apagada */}
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="#1e293b"
                  strokeWidth="2.5"
                  strokeDasharray="4,4"
                />
                {/* Línea de ruta activa iluminada */}
                {isActive && (
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="#0ea5e9"
                    strokeWidth="3.5"
                    filter="url(#glow-neon)"
                    className="animate-pulse"
                  />
                )}
              </g>
            );
          })}

          {/* Renderizado de Nodos */}
          {nodes.map((node) => {
            const Icon = node.icon;
            const isActive = value.includes(node.id);

            return (
              <g 
                key={node.id} 
                className="cursor-pointer transition-transform duration-300 transform hover:scale-105"
                onClick={() => toggleModule(node.id)}
              >
                {/* Resplandor exterior de los nodos activos */}
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="32"
                    fill="rgba(14, 165, 233, 0.15)"
                    stroke="#0ea5e9"
                    strokeWidth="1.5"
                    filter="url(#glow-neon)"
                  />
                )}

                {/* Círculo del nodo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="26"
                  fill={isActive ? '#0f172a' : '#1e293b'}
                  stroke={isActive ? '#38bdf8' : '#475569'}
                  strokeWidth="2"
                  className="transition-all duration-300"
                />

                {/* Icono del módulo */}
                <g transform={`translate(${node.x - 12}, ${node.y - 12})`}>
                  <Icon 
                    size={24} 
                    className={isActive ? 'text-cyan-400' : 'text-slate-500'} 
                  />
                </g>

                {/* Etiqueta */}
                <text
                  x={node.x}
                  y={node.y + 44}
                  textAnchor="middle"
                  fill={isActive ? '#ffffff' : '#64748b'}
                  className="text-[10px] font-bold tracking-wider transition-all duration-300"
                >
                  {node.label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detalle interactivo inferior */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        {nodes.map((node) => {
          const isActive = value.includes(node.id);
          return (
            <div 
              key={node.id}
              onClick={() => toggleModule(node.id)}
              className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                isActive 
                  ? 'bg-cyan-950/20 border-cyan-800/80 hover:border-cyan-600' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="font-bold text-xs text-white">{node.label}</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{node.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
