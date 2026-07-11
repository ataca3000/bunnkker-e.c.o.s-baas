"use client";

import { useCart } from "@/context/CartContext";
import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";

export default function FrontendWidget({ page }: { page: string }) {
    const { siteConfig } = useCart();
    
    // Filtrar widgets para la página actual
    const widgets = siteConfig.widgets?.filter(w => w.page === page) || [];

    if (widgets.length === 0) return null;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {widgets.map((widget, i) => (
                    <motion.div 
                        key={widget.id} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative bg-slate-100 rounded-2xl overflow-hidden h-56 cursor-pointer group shadow-sm hover:shadow-xl transition-all"
                    >
                        <div className="absolute top-0 bottom-0 left-0 w-[70%] bg-gradient-to-r from-slate-900 via-slate-800 to-transparent z-10 skew-x-[-10deg] -ml-10"></div>
                        
                        <div className="relative z-20 h-full p-8 flex flex-col justify-center text-white w-[75%]">
                            <h3 className="text-2xl font-black leading-tight mb-2 drop-shadow-md">{widget.title}</h3>
                            <p className="text-sm font-medium text-slate-300 mb-4 line-clamp-2">{widget.subtitle}</p>
                            <span className="text-xs font-bold tracking-wider hover:text-purple-400 transition-colors flex items-center gap-1 uppercase">
                                {widget.actionText || 'EXPLORAR'} <PlayCircle size={14}/>
                            </span>
                        </div>

                        {/* Background Image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={widget.imageUrl || "https://images.unsplash.com/photo-1557683316-973673baf926?w=500&auto=format&fit=crop"} 
                            alt={widget.title} 
                            className="absolute right-0 top-0 h-full w-[60%] object-cover opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700" 
                        />
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
