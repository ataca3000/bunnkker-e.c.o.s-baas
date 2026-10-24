'use client';

import Image from 'next/image';
import { X, ShoppingBag, Plus, Minus, Trash2, Truck, Sparkles } from 'lucide-react';
import type { CartItem } from '@/context/CartContext';
import styles from '../CartDrawer.module.css';

interface CartItemListProps {
    cart: CartItem[];
    onRemove: (id: string) => void;
    onIncrement?: (id: string) => void;
    onDecrement?: (id: string) => void;
}

/** Lista de productos en el carrito estilo Shopify Polaris con controles stepper de cantidad. */
export function CartItemList({ cart, onRemove, onIncrement, onDecrement }: CartItemListProps) {
    return (
        <div className={styles.cartList}>
            {cart.map(item => {
                const lineTotal = item.quantity * item.price;
                return (
                    <div key={item.id} className={styles.cartItem}>
                        <div className={styles.cartItemImageWrapper}>
                            <Image
                                src={item.image || '/placeholder-product.png'}
                                alt={item.name}
                                width={72}
                                height={72}
                                className={styles.cartItemImage}
                                unoptimized
                            />
                        </div>

                        <div className={styles.cartItemInfo}>
                            <div className={styles.cartItemTop}>
                                <div>
                                    <h4 className={styles.cartItemName}>{item.name}</h4>
                                    {item.category && (
                                        <span className={styles.cartItemCategory}>{item.category}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => onRemove(item.id)}
                                    className={styles.removeIconBtn}
                                    title="Eliminar producto"
                                    aria-label={`Eliminar ${item.name}`}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>

                            <div className={styles.cartItemBottom}>
                                {/* Stepper [-] N [+] */}
                                <div className={styles.stepper}>
                                    <button
                                        type="button"
                                        onClick={() => onDecrement ? onDecrement(item.id) : onRemove(item.id)}
                                        className={styles.stepperBtn}
                                        aria-label="Disminuir cantidad"
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <span className={styles.stepperQty}>{item.quantity}</span>
                                    <button
                                        type="button"
                                        onClick={() => onIncrement && onIncrement(item.id)}
                                        className={styles.stepperBtn}
                                        aria-label="Aumentar cantidad"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>

                                <div className={styles.cartItemPriceBox}>
                                    <div className={styles.cartItemTotal}>
                                        ${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className={styles.cartItemUnitPrice}>
                                        ${item.price.toFixed(2)} c/u
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface FreeShippingBarProps {
    subtotal: number;
    threshold?: number;
}

/** Barra de Envío Gratis animada estilo Shopify */
export function FreeShippingBar({ subtotal, threshold = 999 }: FreeShippingBarProps) {
    const diff = Math.max(0, threshold - subtotal);
    const progress = Math.min(100, Math.round((subtotal / threshold) * 100));
    const hasFreeShipping = diff <= 0;

    return (
        <div className={styles.shippingBanner}>
            <div className={styles.shippingText}>
                {hasFreeShipping ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} color="#008060" /> ¡Felicidades! Tienes <strong>Envío Gratis</strong>
                    </span>
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} /> Te faltan <strong>${diff.toFixed(2)} MXN</strong> para envío gratis
                    </span>
                )}
                <span>{progress}%</span>
            </div>
            <div className={styles.shippingProgressTrack}>
                <div
                    className={styles.shippingProgressBar}
                    style={{ width: `${progress}%` }}
                />
            </div>
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
            <div className={styles.emptyIconWrapper}>
                <ShoppingBag size={38} strokeWidth={1.5} />
            </div>
            <h3 className={styles.emptyTitle}>Tu carrito está vacío</h3>
            <p className={styles.emptyDesc}>
                Explora nuestro catálogo de productos y descubre los mejores materiales y herramientas.
            </p>
            <button onClick={onClose} className={styles.continueBtn}>
                Explorar Catálogo <ShoppingBag size={15} />
            </button>
        </div>
    );
}

interface CartHeaderProps {
    itemCount: number;
    onClose: () => void;
}

/** Encabezado del drawer con título, insignia de conteo y botón de cierre. */
export function CartHeader({ itemCount, onClose }: CartHeaderProps) {
    return (
        <div className={styles.header}>
            <h2 className={styles.headerTitle}>
                <ShoppingBag size={20} color="#008060" />
                Tu Carrito
                <span className={styles.cartCountBadge}>{itemCount}</span>
            </h2>
            <button onClick={onClose} aria-label="Cerrar carrito" title="Cerrar" className={styles.closeBtn}>
                <X size={18} />
            </button>
        </div>
    );
}
