"use client";

import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ShoppingCart, Search, Menu, X, MapPin, Lock, User, Camera, Home, Package, Wrench, Building, Phone } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import CartDrawer from "./CartDrawer";
import BarcodeScanner from "./BarcodeScanner";
import styles from "./Navbar.module.css";
import { toast } from "@/lib/toast";

export default function Navbar() {
    const { cart, products, siteConfig } = useCart();
    const { user, profile } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const pathname = usePathname();

    // No mostrar la Navbar global si estamos dentro del Dashboard Administrativo
    if (pathname?.startsWith('/dashboard')) return null;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        // Unificación: Si es código de barras o ID exacto de producto, hacer consulta de precio
        const found = products.find(p => p.id === searchQuery.trim() || p.barcode === searchQuery.trim());
        if (found) {
            toast.info(`$${found.price.toLocaleString()} MXN · Stock: ${found.stock} uds`, `🔍 ${found.name}`);
            setSearchQuery("");
        } else {
            // Búsqueda normal en catálogo
            window.location.href = `/catalogo?search=${encodeURIComponent(searchQuery)}`;
        }
    };

    const handlePriceScan = (code: string) => {
        const product = products.find(p => p.id === code || p.barcode === code);
        if (product) {
            window.location.href = `/catalogo?search=${encodeURIComponent(code)}`;
        } else {
            toast.warning(`El código ${code} no existe en el catálogo.`);
        }
        setIsScannerOpen(false);
    };

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Animación de rebote (bounce wave) para las letras del logo
    const containerVariants = {
        initial: {},
        animate: {
            transition: {
                staggerChildren: 0.06
            }
        }
    };

    const letterVariants = {
        initial: { y: 0 },
        animate: {
            y: [0, -10, 0, -3, 0],
            transition: {
                duration: 1.0,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 4
            }
        }
    };

    const logoLetters = [
        { char: 'B', color: '#084cb1', shadow: true },
        { char: 'U', color: '#0d74af', shadow: false },
        { char: 'N', color: '#FFFFFF', shadow: false },
        { char: 'KK', color: '#07d3f7', shadow: false },
        { char: 'E', color: '#0ac6ff', shadow: false },
        { char: '.E.C.O.S', color: '#070986', shadow: false, isSuffix: true } // Purple accent for the suffix
    ];

    const isActive = (path: string) => {
        return pathname === path;
    };

    return (
        <>
            <nav className={styles.navbar}>
                {/* Main Nav Bar */}
                <div className={`${styles.container} ${styles.mainNavWrapper}`}>

                    {/* Brand / Logo - Animación de rebote */}
                    <Link href="/" className={styles.brandLink}>
                        <div className={styles.brandColumn}>
                            <motion.div 
                                variants={containerVariants}
                                initial="initial"
                                animate="animate"
                                style={{ display: 'flex', alignItems: 'baseline', gap: '0.5px' }}
                            >
                                {logoLetters.map((l, i) => (
                                    <motion.span
                                        key={i}
                                        variants={letterVariants}
                                        style={{ 
                                            color: l.color,
                                            fontWeight: 950,
                                            fontSize: l.isSuffix ? '1.1rem' : '1.6rem',
                                            lineHeight: 1,
                                            letterSpacing: '-0.5px',
                                            textShadow: l.shadow ? '0 0 2px rgba(0,0,0,0.8), -1px -1px 0 #222, 1px -1px 0 #222, -1px 1px 0 #222, 1px 1px 0 #222' : 'none',
                                        }}
                                    >
                                        {l.char}
                                    </motion.span>
                                ))}
                            </motion.div>
                            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                                {siteConfig.businessName || "ECOSISTEMA COMERCIAL OFFLINE SINCRONIZADO"}
                            </span>
                        </div>
                    </Link>

                    {/* Unified Search Bar - Desktop Only */}
                    <form onSubmit={handleSearch} className={styles.searchFormUnified}>
                        <div className={styles.searchContainer}>
                            <input
                                type="text"
                                placeholder="Buscar producto"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchInputUnified}
                            />
                            <button 
                                type="button" 
                                onClick={() => setIsScannerOpen(true)}
                                className={styles.scanButtonInside}
                                title="QR ScanCámara"
                            >
                                <Camera size={20} color="#0ea5e9" />
                            </button>
                            <button type="submit" aria-label="Buscar" className={styles.searchButtonInside}>
                                <Search size={20} color="#0ea5e9" />
                            </button>
                        </div>
                    </form>

                    {/* Actions Area */}
                    <div className={styles.actionsArea}>

                        {/* Cart Toggle */}
                        <div className={styles.cartWrapper} onClick={() => setIsCartOpen(true)}>
                            <ShoppingCart size={28} color="#0ea5e9" />
                            {cartCount > 0 && (
                                <span className={styles.cartBadge}>
                                    {cartCount}
                                </span>
                            )}
                        </div>

                        {/* Entry point for Login / Cuenta / Dashboard */}
                        <Link
                            href="/cuenta"
                            title="Mi Cuenta / Cliente"
                            className={styles.adminLock}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <User size={18} color="#0ea5e9" />
                        </Link>

                        <div className={styles.mobileToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            {isMenuOpen ? <X size={32} color="#0ea5e9" /> : <Menu size={32} color="#0ea5e9" />}
                        </div>
                    </div>
                </div>

                {/* Mobile Search Row - visible only on mobile screens */}
                <div className={styles.mobileSearchRow}>
                    <form onSubmit={handleSearch} className={styles.mobileSearchForm}>
                        <div className={styles.searchContainer}>
                            <input
                                type="text"
                                placeholder="consultar producto"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchInputUnified}
                            />
                            <button 
                                type="button" 
                                onClick={() => setIsScannerOpen(true)}
                                className={styles.scanButtonInside}
                            >
                                <Camera size={20} color="#0ea5e9" />
                            </button>
                            <button type="submit" aria-label="Buscar" className={styles.searchButtonInside}>
                                <Search size={20} color="#0ea5e9" />
                            </button>
                        </div>
                    </form>
                </div>

                {/* Categories Bar - Desktop */}
                <div className={styles.navCategories}>
                    <div className={styles.navCatContainer}>
                        <Link href="/" className={isActive('/') ? styles.linkActive : styles.linkBase} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={16} /> INICIO</Link>
                        <Link href="/catalogo" className={isActive('/catalogo') ? styles.linkActive : styles.linkBase} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Package size={16} /> CATÁLOGO</Link>
                        <Link href="/servicios" className={isActive('/servicios') ? styles.linkActive : styles.linkBase} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Wrench size={16} /> SERVICIOS</Link>
                        <Link href="/nosotros" className={isActive('/nosotros') ? styles.linkActive : styles.linkBase} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building size={16} /> EMPRESA</Link>
                        <Link href="/contacto" className={isActive('/contacto') ? styles.linkActive : styles.linkBase} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={16} /> CONTACTO</Link>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className={styles.mobileMenu}>
                        <div className={styles.mobileMenuContent}>
                            <Link href="/" onClick={() => setIsMenuOpen(false)} className={isActive('/') ? styles.mobileLinkActive : styles.mobileLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Home size={18} /> INICIO</Link>
                            <Link href="/catalogo" onClick={() => setIsMenuOpen(false)} className={isActive('/catalogo') ? styles.mobileLinkActive : styles.mobileLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={18} /> CATÁLOGO</Link>
                            <Link href="/servicios" onClick={() => setIsMenuOpen(false)} className={isActive('/servicios') ? styles.mobileLinkActive : styles.mobileLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wrench size={18} /> SERVICIOS</Link>
                            <Link href="/nosotros" onClick={() => setIsMenuOpen(false)} className={isActive('/nosotros') ? styles.mobileLinkActive : styles.mobileLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Building size={18} /> EMPRESA</Link>
                            <Link href="/contacto" onClick={() => setIsMenuOpen(false)} className={isActive('/contacto') ? styles.mobileLinkActive : styles.mobileLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={18} /> CONTACTO</Link>
                        </div>
                    </div>
                )}
            </nav>

            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
            {isScannerOpen && (
                <BarcodeScanner
                    onScanSuccess={handlePriceScan}
                    onClose={() => setIsScannerOpen(false)}
                    mode="customer"
                />
            )}
        </>
    );
}
