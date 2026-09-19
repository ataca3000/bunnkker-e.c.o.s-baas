"use client";

import { motion } from 'framer-motion';
import { TrendingDown, Clock, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';

const offers = [
    { id: 'offer-1', name: 'Impermeabilizante Fester 19L', oldPrice: 2150, newPrice: 1850, discount: '-14%', image: 'https://images.unsplash.com/photo-1562259920-47afc305f369?q=80&w=400', end: '24h', category: 'Acabados', stock: 25 },
    { id: 'offer-2', name: 'Kit Herramientas Básicas', oldPrice: 850, newPrice: 699, discount: '-18%', image: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?q=80&w=400', end: '48h', category: 'Herramientas', stock: 15 },
    { id: 'offer-3', name: 'Pintura Vinílica Blanca 19L', oldPrice: 1350, newPrice: 1150, discount: '-15%', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=400', end: '12h', category: 'Acabados', stock: 40 },
    { id: 'offer-4', name: 'Taladro Percutor 1/2"', oldPrice: 1200, newPrice: 950, discount: '-20%', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=400', end: '5h', category: 'Herramientas', stock: 10 },
];

export default function OffersPage() {
    const { addToCart } = useCart();

    const handleAddOffer = (offer: typeof offers[0]) => {
        addToCart({
            id: offer.id,
            name: offer.name,
            price: offer.newPrice,
            stock: offer.stock,
            category: offer.category,
            image: offer.image,
        });
    };

    return (
        <main style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', paddingBottom: '4rem' }}>
            <div style={{ backgroundColor: '#E30613', color: 'white', padding: '4rem 0', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', margin: 0 }}>
                    <TrendingDown size={48} color="#FFCB05" /> OFERTAS RELÁMPAGO
                </h1>
                <p style={{ fontSize: '1.2rem', opacity: 0.9, marginTop: '1rem' }}>Descuentos exclusivos para clientes registrados. ¡Aprovecha hoy!</p>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                    {offers.map((offer) => (
                        <motion.div
                            key={offer.id}
                            whileHover={{ y: -5 }}
                            style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', position: 'relative' }}
                        >
                            <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#FFCB05', color: '#0ea5e9', fontWeight: 'bold', padding: '5px 12px', borderRadius: '40px', zIndex: 10, fontSize: '0.9rem' }}>
                                {offer.discount}
                            </div>

                            <div style={{ height: '220px', overflow: 'hidden' }}>
                                <Image src={offer.image} alt={offer.name} width={400} height={220} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                            </div>

                            <div style={{ padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', height: '3rem', overflow: 'hidden' }}>{offer.name}</h3>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#E30613' }}>${offer.newPrice}</span>
                                    <span style={{ fontSize: '1.1rem', color: '#999', textDecoration: 'line-through' }}>${offer.oldPrice}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Clock size={14} /> Termina en {offer.end}
                                    </span>
                                    <button
                                        onClick={() => handleAddOffer(offer)}
                                        className="btn-sanjose"
                                        style={{ fontSize: '0.8rem', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <ShoppingCart size={14} /> AGREGAR
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </main>
    );
}
