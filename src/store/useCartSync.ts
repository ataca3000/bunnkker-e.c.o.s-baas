"use client";

import { useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, hasRealCredentials } from '@/lib/firebase';
import { useERPStore } from '@/store/useERPStore';
import { useAuth } from '@/context/AuthContext';
import { type CartItem } from '@/context/CartContext';

export function useCartSync() {
    const { user, isPremium } = useAuth();
    const cart = useERPStore(state => state.cart);
    const setCart = useERPStore(state => state.setCart);
    
    // Ref para tener siempre el valor más reciente del carrito sin disparar efectos
    const latestCartRef = useRef(cart);
    useEffect(() => {
        latestCartRef.current = cart;
    }, [cart]);

    // 1. ESCUCHAR cambios desde Firestore (Nube -> Local)
    useEffect(() => {
        const fbUid = auth?.currentUser?.uid;
        if (!hasRealCredentials || !fbUid || !user || !isPremium) return;

        const cartRef = doc(db, 'users', fbUid, 'cart', 'current');
        const unsub = onSnapshot(cartRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const remoteCart = docSnap.data().items || [];
                
                const localStr = JSON.stringify(latestCartRef.current);
                const remoteStr = JSON.stringify(remoteCart);

                if (localStr !== remoteStr) {
                    const mergedCart = [...latestCartRef.current];
                    
                    remoteCart.forEach((remoteItem: any) => {
                        const localIndex = mergedCart.findIndex(i => i.id === remoteItem.id);
                        if (localIndex > -1) {
                            if ((remoteItem.lastModified || 0) > ((mergedCart[localIndex] as any).lastModified || 0)) {
                                mergedCart[localIndex] = remoteItem;
                            }
                        } else {
                            mergedCart.push(remoteItem);
                        }
                    });

                    setCart(mergedCart);
                }
            }
        }, (err: any) => {
            console.warn('[useCartSync] Sincronización de carrito en modo local:', err?.message);
        });

        return () => unsub();
    }, [user, isPremium, setCart]); 

    // 2. GUARDAR cambios en Firestore (Local -> Nube)
    useEffect(() => {
        const fbUid = auth?.currentUser?.uid;
        if (!hasRealCredentials || !fbUid || !user || !isPremium) return;

        const timer = setTimeout(async () => {
            const cartRef = doc(db, 'users', fbUid, 'cart', 'current');
            try {
                await setDoc(cartRef, { items: cart, updatedAt: serverTimestamp() }, { merge: true });
            } catch (err) {
                console.warn("Cart sync fallback (local):", err);
            }
        }, 1000); // Debounce de 1 segundo

        return () => clearTimeout(timer);
    }, [cart, user, isPremium]);
}
