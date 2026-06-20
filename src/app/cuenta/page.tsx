"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, CreditCard, ShoppingBag, LogOut, Plus, Trash2, Edit, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

import type { Order } from '@/lib/types';

interface Address {
    id: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

interface PaymentMethod {
    id: string;
    type: string;
    last4: string;
    expiry: string;
}

export default function UserAccount() {
    // @ts-ignore - Si userData no está en el tipo pero sí en el valor
    const { user, userData, loading }: any = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('orders');

    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    
    const [newAddress, setNewAddress] = useState({ street: '', city: '', state: '', zip: '', country: 'México' });
    const [showAddressForm, setShowAddressForm] = useState(false);

    const [newPayment, setNewPayment] = useState({ type: 'Credit Card', last4: '', expiry: '' });
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [hoveredStars, setHoveredStars] = useState<Record<string, number>>({});
    const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

    const handleRateProduct = async (orderId: string, productId: string, rating: number) => {
        try {
            const commentText = reviewComments[`${orderId}-${productId}`] || '';
            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) {
                alert("El producto no existe en el catálogo.");
                return;
            }
            const pData = productSnap.data();
            const currentRating = pData.rating || 0;
            const currentReviewCount = pData.reviewCount || 0;

            const newReviewCount = currentReviewCount + 1;
            const newRating = parseFloat(((currentRating * currentReviewCount + rating) / newReviewCount).toFixed(1));

            // Actualizar producto
            await updateDoc(productRef, {
                rating: newRating,
                reviewCount: newReviewCount
            });

            // Registrar reseña
            await addDoc(collection(db, 'reviews'), {
                productId,
                orderId,
                customerName: userData?.displayName || user.email || 'Cliente verificado',
                rating,
                comment: commentText,
                date: new Date().toISOString()
            });

            // Registrar voto en la orden
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                const ratedItems = orderData.ratedItems || {};
                ratedItems[productId] = rating;
                await updateDoc(orderRef, { ratedItems });
            }

            alert("¡Muchas gracias por calificar y reseñar el producto!");
            setReviewComments(prev => {
                const copy = { ...prev };
                delete copy[`${orderId}-${productId}`];
                return copy;
            });
            fetchData();
        } catch (error) {
            console.error("Error al calificar producto:", error);
            alert("Ocurrió un error al enviar tu calificación.");
        }
    };

    useEffect(() => {
        if (!loading && (!user || (userData && userData.role !== 'customer'))) {
            router.push('/');
        }
    }, [user, userData, loading, router]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        
        try {
            // Fetch Addresses
            const addrSnapshot = await getDocs(collection(db, 'users', user.uid, 'addresses'));
            setAddresses(addrSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));

            // Fetch Payments
            const paySnapshot = await getDocs(collection(db, 'users', user.uid, 'payment_methods'));
            setPaymentMethods(paySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));

            // Fetch Orders (assumes email or userId match)
            const q = query(
                collection(db, 'orders'),
                where('customerEmail', '==', user.email || '')
            );
            const orderSnapshot = await getDocs(q);
            setOrders(orderSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/');
    };

    const handleAddAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            await addDoc(collection(db, 'users', user.uid, 'addresses'), newAddress);
            setShowAddressForm(false);
            setNewAddress({ street: '', city: '', state: '', zip: '', country: 'México' });
            fetchData();
        } catch (error) {
            console.error("Error adding address", error);
        }
    };

    const handleDeleteAddress = async (addressId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
            fetchData();
        } catch (error) {
            console.error("Error deleting address", error);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            // Guardamos solo ultimos 4 digitos y expiry como ejemplo seguro
            await addDoc(collection(db, 'users', user.uid, 'payment_methods'), newPayment);
            setShowPaymentForm(false);
            setNewPayment({ type: 'Credit Card', last4: '', expiry: '' });
            fetchData();
        } catch (error) {
            console.error("Error adding payment", error);
        }
    };

    const handleDeletePayment = async (methodId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'payment_methods', methodId));
            fetchData();
        } catch (error) {
            console.error("Error deleting payment method", error);
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-[#F8F9FA] py-12 px-4">
            <div className="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-[minmax(250px,1fr)_3fr] gap-8">
                
                {/* Sidebar Navigation */}
                <div className="card-sanjose p-6 self-start">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-[#2563EB] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                            {userData?.displayName?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold m-0">{userData?.displayName || 'Mi Cuenta'}</h2>
                        <p className="text-gray-500 text-sm">{user.email}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => setActiveTab('profile')} 
                            className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer'}`}
                        >
                            <User size={18} /> Mi Perfil
                        </button>
                        <button 
                            onClick={() => setActiveTab('orders')} 
                            className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'orders' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer'}`}
                        >
                            <ShoppingBag size={18} /> Mis Pedidos
                        </button>
                        <button 
                            onClick={() => setActiveTab('addresses')} 
                            className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'addresses' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer'}`}
                        >
                            <MapPin size={18} /> Direcciones
                        </button>
                        <button 
                            onClick={() => setActiveTab('payment')} 
                            className={`px-4 py-2.5 text-left rounded-lg border-none flex items-center gap-3 transition-colors ${activeTab === 'payment' ? 'bg-[#2563EB] text-white font-bold' : 'bg-transparent text-gray-700 cursor-pointer'}`}
                        >
                            <CreditCard size={18} /> Métodos de Pago
                        </button>
                        <hr className="my-4 border-gray-100" />
                        <button onClick={handleLogout} className="px-4 py-2.5 text-left rounded-lg border-none bg-red-50 text-red-600 cursor-pointer flex items-center gap-3 font-bold transition-colors hover:bg-red-100">
                            <LogOut size={18} /> Cerrar Sesión
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="card-sanjose p-8">
                    <AnimatePresence mode="wait">
                        {activeTab === 'orders' && (
                            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h3 className="text-2xl font-bold mb-6 text-[#1a1a1a] flex items-center gap-3">
                                    <ShoppingBag color="#2563EB" /> Mis Pedidos
                                </h3>
                                {orders.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No tienes historial de pedidos aún.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-6">
                                        {orders.map(order => (
                                            <div key={order.id} className="border border-gray-100 rounded-xl p-6 bg-white shadow-sm flex flex-col gap-4">
                                                <div className="flex justify-between items-start flex-wrap gap-4 pb-4 border-b border-gray-50">
                                                    <div>
                                                        <div className="font-extrabold text-lg text-slate-900 mb-1">Recibo #{order.id.slice(0, 8)}</div>
                                                        <div className="text-xs text-gray-400 font-semibold">Fecha: {order.date ? new Date(order.date).toLocaleDateString() : 'Sin fecha'}</div>
                                                        <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[9px] font-black tracking-widest mt-2">
                                                            ESTADO: {order.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-[#1a1a1a] text-xl">${order.total.toLocaleString()} MXN</div>
                                                        <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">{order.items?.length || 0} módulos adquiridos</div>
                                                    </div>
                                                </div>

                                                {/* Detalle de Productos/Licencias */}
                                                <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Detalle de tu orden</p>
                                                    {order.items?.map((item: any) => (
                                                        <div key={item.id} className="flex justify-between items-center flex-wrap gap-4 pb-3 last:pb-0 border-b border-slate-200/50 last:border-none">
                                                            <div className="flex items-center gap-3">
                                                                {item.image && (
                                                                    <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl shadow-sm bg-white shrink-0 border border-slate-100" />
                                                                )}
                                                                <div>
                                                                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                                                                    <div className="text-xs text-slate-400 font-semibold">{item.category}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <div className="text-sm font-bold text-slate-800">${item.price.toLocaleString()} x {item.quantity}</div>
                                                                
                                                                {/* Selector de Estrellas */}
                                                                {(() => {
                                                                    const ratedRating = (order as any).ratedItems?.[item.id];
                                                                    return (
                                                                        <div className="flex items-center gap-1.5 mt-2.5">
                                                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mr-1">Calificar:</span>
                                                                            {ratedRating ? (
                                                                                <div className="flex items-center gap-0.5">
                                                                                    {[1, 2, 3, 4, 5].map(star => (
                                                                                        <Star 
                                                                                            key={star} 
                                                                                            size={12} 
                                                                                            fill={star <= ratedRating ? "#FFCB05" : "none"} 
                                                                                            color={star <= ratedRating ? "#FFCB05" : "#cbd5e1"} 
                                                                                        />
                                                                                    ))}
                                                                                    <span className="text-[8px] text-emerald-600 font-black uppercase tracking-wider ml-1.5">✓ Calificado</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex flex-col items-end gap-1.5">
                                                                                    <div className="flex items-center gap-0.5">
                                                                                        {[1, 2, 3, 4, 5].map(star => {
                                                                                            const hoverKey = `${order.id}-${item.id}`;
                                                                                            const currentHover = hoveredStars[hoverKey] || 0;
                                                                                            return (
                                                                                                <button
                                                                                                    key={star}
                                                                                                    type="button"
                                                                                                    onClick={() => handleRateProduct(order.id, item.id, star)}
                                                                                                    onMouseEnter={() => setHoveredStars({ ...hoveredStars, [hoverKey]: star })}
                                                                                                    onMouseLeave={() => setHoveredStars({ ...hoveredStars, [hoverKey]: 0 })}
                                                                                                    className="p-0.5 bg-transparent border-none cursor-pointer hover:scale-125 transition-transform focus:outline-none"
                                                                                                >
                                                                                                    <Star 
                                                                                                        size={14} 
                                                                                                        fill={star <= currentHover ? "#FFCB05" : "none"} 
                                                                                                        color={star <= currentHover ? "#FFCB05" : "#94a3b8"} 
                                                                                                    />
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                    <input 
                                                                                        type="text" 
                                                                                        placeholder="Opinión opcional..." 
                                                                                        value={reviewComments[`${order.id}-${item.id}`] || ''}
                                                                                        onChange={(e) => setReviewComments({ ...reviewComments, [`${order.id}-${item.id}`]: e.target.value })}
                                                                                        className="px-2 py-1 text-[10px] rounded border border-slate-200 outline-none focus:border-blue-500 w-[140px] bg-white text-slate-800 font-semibold"
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'addresses' && (
                            <motion.div key="addresses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-3">
                                        <MapPin color="#2563EB" /> Mis Direcciones
                                    </h3>
                                    <button onClick={() => setShowAddressForm(!showAddressForm)} className="btn-sanjose py-2 px-4 flex items-center gap-1.5 text-sm">
                                        <Plus size={16} /> Agregar Nueva
                                    </button>
                                </div>

                                {showAddressForm && (
                                    <form onSubmit={handleAddAddress} className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-100">
                                        <h4 className="mb-4 font-bold">Nueva Dirección de Envío</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <input type="text" placeholder="Calle y Número" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <input type="text" placeholder="Ciudad" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                                <input type="text" placeholder="Estado" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <input type="text" placeholder="Código Postal" value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                                <input type="text" placeholder="País" value={newAddress.country} onChange={e => setNewAddress({...newAddress, country: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2.5 mt-6">
                                            <button type="submit" className="btn-sanjose py-2.5 px-5">Guardar</button>
                                            <button type="button" onClick={() => setShowAddressForm(false)} className="btn-sanjose-secondary py-2.5 px-5">Cancelar</button>
                                        </div>
                                    </form>
                                )}

                                {addresses.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">No has guardado ninguna dirección.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {addresses.map(addr => (
                                            <div key={addr.id} className="border border-gray-100 rounded-lg p-6 relative">
                                                <div className="font-bold mb-2.5">{addr.street}</div>
                                                <div className="text-gray-500 text-sm leading-relaxed">
                                                    {addr.city}, {addr.state}<br/>
                                                    CP: {addr.zip}<br/>
                                                    {addr.country}
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteAddress(addr.id)} 
                                                    className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-red-600 transition-opacity hover:opacity-70"
                                                    title="Eliminar dirección"
                                                    aria-label="Eliminar dirección"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'payment' && (
                            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-3">
                                        <CreditCard color="#2563EB" /> Métodos de Pago
                                    </h3>
                                    <button onClick={() => setShowPaymentForm(!showPaymentForm)} className="btn-sanjose py-2 px-4 flex items-center gap-1.5 text-sm">
                                        <Plus size={16} /> Nuevo Método
                                    </button>
                                </div>

                                {showPaymentForm && (
                                    <form onSubmit={handleAddPayment} className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-100">
                                        <h4 className="mb-4 font-bold">Agregar Tarjeta</h4>
                                        <p className="text-xs text-gray-500 mb-4">Introduce los últimos dígitos y expiración para guardarla como referencia rápida (No almacenamos CCV o números completos).</p>
                                        <div className="grid grid-cols-1 gap-4">
                                            <input type="text" placeholder="Tipo (ej. Visa, MasterCard)" value={newPayment.type} onChange={e => setNewPayment({...newPayment, type: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <input type="text" placeholder="Últimos 4 dígitos" maxLength={4} minLength={4} value={newPayment.last4} onChange={e => setNewPayment({...newPayment, last4: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                                <input type="text" placeholder="MM/YY" value={newPayment.expiry} onChange={e => setNewPayment({...newPayment, expiry: e.target.value})} required className="p-2.5 rounded border border-gray-300 outline-none focus:border-[#2563EB]" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2.5 mt-6">
                                            <button type="submit" className="btn-sanjose py-2.5 px-5">Guardar</button>
                                            <button type="button" onClick={() => setShowPaymentForm(false)} className="btn-sanjose-secondary py-2.5 px-5">Cancelar</button>
                                        </div>
                                    </form>
                                )}

                                {paymentMethods.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">No has guardado métodos de pago.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {paymentMethods.map(method => (
                                            <div key={method.id} className="border border-gray-100 rounded-lg p-6 relative flex items-center gap-4">
                                                <div className="bg-[#2563EB] text-white p-2.5 rounded-lg">
                                                    <CreditCard size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold">{method.type}</div>
                                                    <div className="text-gray-500 text-sm">•••• •••• •••• {method.last4}</div>
                                                    <div className="text-gray-400 text-xs">Expira: {method.expiry}</div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeletePayment(method.id)} 
                                                    className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-red-600 transition-opacity hover:opacity-70"
                                                    title="Eliminar método de pago"
                                                    aria-label="Eliminar método de pago"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                        {activeTab === 'profile' && (
                            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-3">
                                        <User color="#2563EB" /> Mi Perfil
                                    </h3>
                                </div>
                                <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                                    <h4 className="font-bold mb-4 text-gray-800">Datos Personales</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                                            <div className="p-3 mt-1 bg-gray-50 border border-gray-200 rounded-md text-gray-800 font-medium">
                                                {userData?.displayName || 'No especificado'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Teléfono</label>
                                            <div className="p-3 mt-1 bg-gray-50 border border-gray-200 rounded-md text-gray-800 font-medium">
                                                {userData?.phone || 'No especificado'}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Correo Electrónico</label>
                                            <div className="p-3 mt-1 bg-gray-50 border border-gray-200 rounded-md text-gray-800 font-medium">
                                                {user.email}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-12 pt-6 border-t border-red-100">
                                        <h4 className="font-bold text-red-600 mb-2">Zona de Peligro</h4>
                                        <p className="text-sm text-gray-500 mb-5">
                                            Si solicitas eliminar tu cuenta, tu solicitud quedará en estado "Pendiente" para que el comercio revise si tienes pagos o pedidos en curso antes de borrar tus datos de forma definitiva.
                                        </p>
                                        <button 
                                            onClick={async () => {
                                                if(confirm('¿Estás seguro de solicitar la eliminación de tu cuenta?')) {
                                                    try {
                                                        await updateDoc(doc(db, 'users', user.uid), { 
                                                            deleteRequested: true, 
                                                            deleteRequestDate: new Date().toISOString() 
                                                        });
                                                        alert('Solicitud enviada. Revisaremos que no haya pedidos pendientes y procederemos a borrar tus datos.');
                                                        // Forzar recarga o actualizar estado local si quisieramos
                                                        window.location.reload();
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('Error al enviar la solicitud.');
                                                    }
                                                }
                                            }}
                                            className={`px-5 py-2.5 font-bold rounded-lg transition-colors border ${userData?.deleteRequested ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer'}`}
                                            disabled={userData?.deleteRequested}
                                        >
                                            {userData?.deleteRequested ? 'Solicitud de Borrado en Proceso...' : 'Solicitar Borrado de Cuenta'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
