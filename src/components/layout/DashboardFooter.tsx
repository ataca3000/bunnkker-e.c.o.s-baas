"use client";

import { Mail, MapPin, MessageSquare } from 'lucide-react';

export default function DashboardFooter() {
    const devInfo = {
        name: "Philip Duran",
        company: "BRECHA SOLUCIONES",
        email: "luishalo69@gmail.com",
        location: "Josefa Ortiz #4, Plan de Ayala, Tetla, Tlaxcala, México",
    };

    const handleWhatsApp = () => {
        // Enlace directo a WhatsApp del desarrollador
        // Reemplaza el número 52... con tu número real de WhatsApp
        window.open('https://wa.me/522411234567', '_blank'); 
    };

    return (
        <footer className="mt-auto py-8 px-6 bg-white border-t border-gray-100">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Soporte Técnico y Desarrollo
                    </p>
                    <h4 className="text-sm font-black text-[#0ea5e9] uppercase italic">
                        ADMIN.COM ERP <span className="text-gray-300">by</span> {devInfo.company}
                    </h4>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                    <a 
                        href={`mailto:${devInfo.email}`}
                        className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-[#0ea5e9] px-4 py-2 rounded-xl text-xs font-bold transition-all border border-gray-100"
                    >
                        <Mail size={14} /> {devInfo.email}
                    </a>
                    
                    <button 
                        onClick={handleWhatsApp}
                        className="flex items-center gap-2 bg-[#27ae60] hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <MessageSquare size={14} /> CONTACTAR DESARROLLADOR
                    </button>
                </div>

                <div className="flex items-center gap-2 text-gray-400">
                    <MapPin size={14} className="text-red-400 shrink-0" />
                    <span className="text-[0.7rem] font-medium max-w-[200px] leading-tight">
                        {devInfo.location}
                    </span>
                </div>
            </div>
            
            <div className="text-center mt-6">
                <p className="text-[0.6rem] text-gray-300 font-bold uppercase">
                    &copy; {new Date().getFullYear()} {devInfo.company} - Hecho en Tlaxcala para el mundo
                </p>
            </div>
        </footer>
    );
}
