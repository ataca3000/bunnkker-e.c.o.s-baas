'use client';

import Image from 'next/image';
import { X, ShoppingBag } from 'lucide-react';
import type { CartItem } from '@/context/CartContext';
import styles from '../CartDrawer.module.css';

interface CartItemListProps {
    cart: CartItem[];
    onRemove: (id: string) => void;
}

/** Lista de productos en el carrito — paso 1 del drawer. */
export function CartItemList({ cart, onRemove }: CartItemListProps) {
    return (
        <div className={styles.cartList}>
            {cart.map(item => (
                <div key={item.id} className={styles.cartItem}>
                    <Image
                        src={item.image || '/placeholder-product.png'}
                        alt={item.name}
                        width={60}
                        height={60}
                        className={styles.cartItemImage}
                        unoptimized
                    />
                    <div className={styles.cartItemInfo}>
                        <h4 className={styles.cartItemName}>{item.name}</h4>
                        <div className={styles.cartItemPricing}>
                            <span className={styles.cartItemQty}>{item.quantity} x ${item.price}</span>
                            <span className={styles.cartItemTotal}>${item.quantity * item.price}</span>
                        </div>
                        <button onClick={() => onRemove(item.id)} className={styles.removeBtn}>
                            Eliminar
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface CartEmptyStateProps {
    onClose: () => void;
}

/** Estado vacío cuando no hay productos en el carrito. */
export function CartEmptyState({ onClose }: CartEmptyStateProps) {
    return (
        <div className={styles.emptyState}>
            <ShoppingBag size={48} className={styles.emptyIcon} />
            <p>Tu carrito está vacío.</p>
            <button onClick={onClose} className={`btn-sanjose ${styles.continueBtn}`}>
                Seguir Comprando
            </button>
        </div>
    );
}

interface CartHeaderProps {
    onClose: () => void;
}

/** Encabezado del drawer con título y botón de cierre. */
export function CartHeader({ onClose }: CartHeaderProps) {
    return (
        <div className={styles.header}>
            <h2 className={styles.headerTitle}>
                <ShoppingBag /> TU ORDEN
            </h2>
            <button onClick={onClose} aria-label="Cerrar carrito" title="Cerrar" className={styles.closeBtn}>
                <X size={24} />
            </button>
        </div>
    );
}
