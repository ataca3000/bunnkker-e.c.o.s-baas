"use client";

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { toast } from '@/lib/toast';

// Define a local interface extension to ensure the compiler recognizes redirectToCheckout
interface StripeWithCheckout extends Stripe {
    redirectToCheckout(options: { sessionId: string }): Promise<{ error?: { message: string } }>;
}

// Initialize Stripe outside of the component. 
// This starts loading the Stripe.js script as soon as the app loads,
// which is a Stripe best practice to improve conversion rates.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function UpgradeBanner() {
    const { isPremium, loading, user } = useAuth();
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleUpgrade = async () => {
        if (!user) return router.push('/login');
        
        setIsRedirecting(true);
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, email: user.email }),
            });
            
            if (!response.ok) {
                throw new Error('No se pudo crear la sesión de pago');
            }

            const { sessionId } = await response.json();
            const stripe = (await stripePromise) as StripeWithCheckout | null;
            
            if (stripe) {
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) {
                    throw new Error(error.message);
                }
            }
        } catch (error) {
            console.error("Stripe Checkout Error:", error);
            toast.error('Error al iniciar el pago. Inténtalo de nuevo.', 'Pago');
        } finally {
            setIsRedirecting(false);
        }
    };

    if (loading || isPremium) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#0ea5e9] to-[#0066CC] p-4 rounded-xl shadow-lg border border-blue-400/20 flex items-center justify-between mb-8 text-white"
        >
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-lg">
                    <Sparkles className="text-yellow-300" size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-sm md:text-base">Estás usando el Plan Local (Gratis)</h4>
                    <p className="text-xs text-blue-100 opacity-90">Activa el Plan Premium para sincronizar tus datos en la nube y acceder desde cualquier lugar.</p>
                </div>
            </div>
            <button 
                onClick={handleUpgrade}
                disabled={isRedirecting}
                className="bg-white text-[#0ea5e9] px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-yellow-400 hover:text-black transition-all shrink-0 ml-4 disabled:opacity-50"
            >
                {isRedirecting ? <Loader2 className="animate-spin" size={14} /> : <>ACTIVAR AHORA <ArrowRight size={14} /></>}
            </button>
        </motion.div>
    );
}
