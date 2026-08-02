import React from 'react';
import { Store, ShoppingCart } from 'lucide-react';

export default async function TenantStorefront({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar Minimalista */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">
              {tenantId.replace(/-/g, ' ')}
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Powered by BUNKKER E.C.O.S
            </p>
          </div>
        </div>

        <button className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold transition-colors">
          <ShoppingCart className="w-4 h-4" />
          <span>Carrito</span>
        </button>
      </nav>

      {/* Contenido Principal (Catálogo que vendrá de Firebase Firestore) */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-slate-900 mb-4">Catálogo en Línea</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Este es el aparador público de la tienda. El inventario se sincroniza en tiempo real con el sistema físico del comercio gracias a la infraestructura Cloud-Sync.
          </p>
        </div>

        {/* Grid de Productos (Mock) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
              <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                <Store className="w-12 h-12 text-slate-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-slate-900 mb-1">Producto de Prueba {i}</h3>
                <p className="text-sm text-slate-500 mb-4">Categoría Demo</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-purple-600">$299.00</span>
                  <button className="w-10 h-10 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-600 flex items-center justify-center transition-colors">
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
