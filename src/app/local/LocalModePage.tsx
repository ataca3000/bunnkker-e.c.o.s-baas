'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { addLocalStaffUser, authenticateLocalUser, commitLocalSale, getLocalSettings, listLocalOrders, listLocalProducts, listLocalUsers, LocalOrder, LocalProduct, LocalRole, LocalSettings, LocalStaffUser, saveLocalProduct } from '@/lib/standaloneLocalStore';

type View = 'sales' | 'products' | 'staff' | 'orders';

export default function LocalModePage() {
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [users, setUsers] = useState<LocalStaffUser[]>([]);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [session, setSession] = useState<LocalStaffUser | null>(null);
  const [view, setView] = useState<View>('sales');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [pin, setPin] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const refreshData = useCallback(async () => {
    const [nextProducts, nextOrders, nextUsers] = await Promise.all([listLocalProducts(), listLocalOrders(), listLocalUsers()]);
    setProducts(nextProducts);
    setOrders(nextOrders);
    setUsers(nextUsers);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getLocalSettings(), listLocalUsers()])
      .then(([localSettings, localUsers]) => {
        if (!active) return;
        setSettings(localSettings);
        setUsers(localUsers);
        if (localSettings) return refreshData();
        return undefined;
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el almacenamiento local.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshData]);

  const cartTotal = useMemo(() => products.reduce((sum, product) => sum + product.price * (quantities[product.id] || 0), 0), [products, quantities]);
  const isAdmin = session?.role === 'admin';

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await (await import('@/lib/standaloneLocalStore')).initializeLocalDevice(businessName, adminName, pin);
      setSettings(await getLocalSettings());
      setUsers(await listLocalUsers());
      setPin('');
      setNotice('Dispositivo configurado. Ya puedes iniciar sesión.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo configurar el dispositivo.'); }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const user = await authenticateLocalUser(adminName, pin);
      if (!user) { setError('Nombre o PIN incorrectos.'); return; }
      setSession(user);
      setAdminName(user.name);
      setPin('');
      await refreshData();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.'); }
  }

  async function handleProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await saveLocalProduct({ name: String(form.get('name') || ''), price: Number(form.get('price')), stock: Number(form.get('stock')) });
      event.currentTarget.reset();
      await refreshData();
      setNotice('Producto guardado en este dispositivo.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el producto.'); }
  }

  async function handleStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await addLocalStaffUser(String(form.get('name') || ''), String(form.get('pin') || ''), String(form.get('role')) as LocalRole);
      event.currentTarget.reset();
      await refreshData();
      setNotice('Personal agregado al almacenamiento local.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo agregar al personal.'); }
  }

  async function handleSale() {
    if (!session) return;
    setError('');
    try {
      await commitLocalSale(session.name, quantities);
      setQuantities({});
      await refreshData();
      setNotice('Venta guardada localmente y existencias actualizadas.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar la venta.'); }
  }

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-slate-200">Abriendo almacenamiento local…</main>;

  const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500';
  const buttonClass = 'rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">BUNKKER E.C.O.S.</p>
            <h1 className="mt-1 text-3xl font-bold">Modo autónomo local</h1>
            <p className="mt-2 text-sm text-slate-400">Catálogo, personal y ventas se guardan en este dispositivo. Esta pantalla no sincroniza ni envía datos.</p>
          </div>
          {session && <div className="text-right text-sm text-slate-300"><p>{settings?.businessName}</p><p>{session.name} · {session.role}</p><button className="mt-2 text-cyan-400 underline" onClick={() => setSession(null)}>Cerrar sesión</button></div>}
        </header>

        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-emerald-200">{notice}</p>}

        {!settings ? (
          <section className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="mb-4 text-xl font-bold">Configurar este dispositivo</h2>
            <form className="space-y-4" onSubmit={handleSetup}>
              <label className="block space-y-1 text-sm">Nombre del negocio<input className={inputClass} required value={businessName} onChange={event => setBusinessName(event.target.value)} /></label>
              <label className="block space-y-1 text-sm">Nombre de administrador<input className={inputClass} required value={adminName} onChange={event => setAdminName(event.target.value)} /></label>
              <label className="block space-y-1 text-sm">PIN (4 a 8 dígitos)<input className={inputClass} required inputMode="numeric" pattern="[0-9]{4,8}" value={pin} onChange={event => setPin(event.target.value)} /></label>
              <button className={buttonClass}>Configurar almacenamiento local</button>
            </form>
          </section>
        ) : !session ? (
          <section className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="mb-4 text-xl font-bold">Iniciar sesión · {settings.businessName}</h2>
            <form className="space-y-4" onSubmit={handleLogin}>
              <label className="block space-y-1 text-sm">Personal<select className={inputClass} required value={adminName} onChange={event => setAdminName(event.target.value)}><option value="">Selecciona tu usuario</option>{users.map(user => <option key={user.id} value={user.name}>{user.name} · {user.role}</option>)}</select></label>
              <label className="block space-y-1 text-sm">PIN<input className={inputClass} required inputMode="numeric" pattern="[0-9]{4,8}" value={pin} onChange={event => setPin(event.target.value)} /></label>
              <button className={buttonClass}>Entrar</button>
            </form>
          </section>
        ) : (
          <>
            <nav aria-label="Secciones del modo local" className="flex flex-wrap gap-2">
              {(['sales', 'products', ...(isAdmin ? ['staff'] : []), 'orders'] as View[]).map(item => <button key={item} onClick={() => { setView(item); setError(''); setNotice(''); }} aria-current={view === item ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === item ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{({ sales: 'Venta', products: 'Catálogo', staff: 'Personal', orders: 'Ventas registradas' })[item]}</button>)}
            </nav>

            {view === 'sales' && <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="mb-4 text-xl font-bold">Catálogo local</h2>{products.length ? <div className="grid gap-3 sm:grid-cols-2">{products.map(product => <article key={product.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-sm text-slate-400">${product.price.toFixed(2)} · Existencia: {product.stock}</p><div className="mt-3 flex items-center gap-2"><button aria-label={`Quitar ${product.name}`} className="rounded bg-slate-800 px-3 py-1" onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1) }))}>−</button><span>{quantities[product.id] || 0}</span><button aria-label={`Agregar ${product.name}`} disabled={product.stock <= (quantities[product.id] || 0)} className="rounded bg-slate-800 px-3 py-1 disabled:opacity-50" onClick={() => setQuantities(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }))}>+</button></div></article>)}</div> : <p className="text-slate-400">Aún no hay productos. Un administrador puede agregarlos en Catálogo.</p>}</div>
              <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-xl font-bold">Cobro local</h2><p className="my-4 text-3xl font-bold text-cyan-300">${cartTotal.toFixed(2)}</p><button className={`${buttonClass} w-full`} disabled={!Object.values(quantities).some(quantity => quantity > 0)} onClick={handleSale}>Registrar venta</button><p className="mt-3 text-xs text-slate-500">La venta y la reducción de existencias se guardan juntas en IndexedDB.</p></aside>
            </section>}

            {view === 'products' && <section className="grid gap-6 lg:grid-cols-[320px_1fr]"><form onSubmit={handleProduct} className="h-fit space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-xl font-bold">Agregar producto</h2><label className="block space-y-1 text-sm">Nombre<input className={inputClass} name="name" required /></label><label className="block space-y-1 text-sm">Precio<input className={inputClass} name="price" type="number" min="0" step="0.01" required /></label><label className="block space-y-1 text-sm">Existencia inicial<input className={inputClass} name="stock" type="number" min="0" step="1" required /></label><button className={buttonClass}>Guardar producto</button></form><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="mb-4 text-xl font-bold">Productos ({products.length})</h2><ul className="divide-y divide-slate-800">{products.map(product => <li key={product.id} className="flex justify-between gap-3 py-3"><span>{product.name}</span><span className="text-slate-400">${product.price.toFixed(2)} · {product.stock} uds.</span></li>)}</ul></div></section>}

            {view === 'staff' && isAdmin && <section className="grid gap-6 lg:grid-cols-[320px_1fr]"><form onSubmit={handleStaff} className="h-fit space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-xl font-bold">Agregar personal</h2><label className="block space-y-1 text-sm">Nombre<input className={inputClass} name="name" required /></label><label className="block space-y-1 text-sm">PIN (4 a 8 dígitos)<input className={inputClass} name="pin" inputMode="numeric" pattern="[0-9]{4,8}" required /></label><label className="block space-y-1 text-sm">Rol<select className={inputClass} name="role"><option value="cashier">Cajero</option><option value="admin">Administrador</option></select></label><button className={buttonClass}>Agregar usuario local</button></form><div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="mb-4 text-xl font-bold">Personal ({users.length})</h2><ul className="divide-y divide-slate-800">{users.map(user => <li key={user.id} className="flex justify-between py-3"><span>{user.name}</span><span className="text-slate-400">{user.role}</span></li>)}</ul></div></section>}

            {view === 'orders' && <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="mb-4 text-xl font-bold">Ventas locales ({orders.length})</h2>{orders.length ? <ul className="space-y-3">{orders.map(order => <li key={order.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>${order.total.toFixed(2)}</strong><span className="text-sm text-slate-400">{new Date(order.createdAt).toLocaleString()}</span></div><p className="mt-1 text-sm text-slate-400">Atendió: {order.cashierName}</p><ul className="mt-2 text-sm">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.quantity} × {item.name} · ${(item.quantity * item.unitPrice).toFixed(2)}</li>)}</ul></li>)}</ul> : <p className="text-slate-400">Todavía no hay ventas.</p>}</section>}
          </>
        )}
      </div>
    </main>
  );
}
