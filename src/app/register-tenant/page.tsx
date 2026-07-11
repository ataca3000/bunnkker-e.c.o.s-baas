"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Rocket, Building, ShieldCheck, Smartphone, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useERPStore } from "@/store/useERPStore";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export default function RegisterTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [businessName, setBusinessName] = useState('');
  const [subdomain, setSubdomain] = useState('');

  // Phone Auth data
  const [usePhone, setUsePhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any | null>(null);

  useEffect(() => {
    // Inicializar reCAPTCHA para autenticación por teléfono
    if (typeof window !== 'undefined' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
    }
  }, []);

  const checkSubdomain = async (sub: string) => {
    const q = query(collection(db, 'tenants_registry'), where('subdomain', '==', sub));
    const snap = await getDocs(q);
    return snap.empty; // true if available
  };

  const createTenantData = async (user: any, phoneAuth = false) => {
    const isAvailable = await checkSubdomain(subdomain.toLowerCase());
    if (!isAvailable) {
      throw new Error('Ese subdominio ya está ocupado. Elige otro.');
    }

    const tenantId = subdomain.toLowerCase();
    const newSessionId = Math.random().toString(36).substring(2);

    // 1. Register Tenant globally
    await setDoc(doc(db, 'tenants_registry', tenantId), {
      businessName,
      subdomain: tenantId,
      ownerUid: user.uid,
      createdAt: new Date(),
      status: 'active'
    });

    // 2. Create Superadmin User
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email || `${phoneAuth ? phone : 'user'}@${tenantId}.com`,
      phone: phoneAuth ? phone : user.phoneNumber || '',
      role: 'superadmin',
      tenantId: tenantId,
      name: user.displayName || 'Propietario',
      createdAt: new Date(),
      currentSessionId: newSessionId
    });

    // 3. Create initial site config
    await setDoc(doc(db, 'settings', 'site_config'), {
      businessName,
      tenantId,
      setupCompleted: true,
      createdAt: new Date()
    });

    localStorage.setItem('msj-session-id', newSessionId);
    document.cookie = `msj-session=${user.uid}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `msj-role=superadmin; path=/; max-age=86400; SameSite=Lax`;
    
    setStep(3); // Success
  };

  const handleGoogleAuth = async () => {
    if (!businessName || !subdomain) return setError('Llena los datos de tu empresa primero.');
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await createTenantData(result.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!businessName || !subdomain) return setError('Llena los datos de tu empresa primero.');
    if (!phone || phone.length < 10) return setError('Ingresa un número de teléfono válido (con código de país ej. +52).');
    
    setLoading(true);
    setError('');
    try {
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      setStep(2); // OTP Verification step
    } catch (err: any) {
      console.error(err);
      setError('Error al enviar SMS. Verifica el formato (+52...).');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !confirmationResult) return;
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      await createTenantData(result.user, true);
    } catch (err: any) {
      console.error(err);
      setError('Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px]"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/80 backdrop-blur-xl rounded-[40px] p-8 md:p-10 shadow-2xl border border-slate-700/50"
        >
          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30 border border-white/10">
                  <Rocket className="text-white" size={32} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">Crea tu Instancia</h2>
                <p className="mt-2 text-sm text-slate-400 font-medium">Configura tu ERP de Marca Blanca en segundos.</p>
              </div>

              {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-xl mb-6 text-sm font-bold border border-red-500/30">{error}</div>}

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">Nombre de la Empresa</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      required 
                      type="text" 
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 border border-slate-700/50 rounded-2xl focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-slate-900/50 text-white transition-all outline-none font-semibold" 
                      placeholder="Ej. Mi Tienda S.A." 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">Subdominio deseado</label>
                  <div className="flex rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden focus-within:ring-1 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all">
                    <input 
                      required 
                      type="text" 
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="flex-1 min-w-0 block w-full px-4 py-4 bg-slate-900/50 text-white outline-none font-semibold" 
                      placeholder="mitienda" 
                    />
                    <span className="inline-flex items-center px-4 bg-slate-800 text-slate-400 text-sm font-bold border-l border-slate-700/50">
                      .erp-pro.com
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-slate-500 mt-2 ml-2">Solo minúsculas y números, sin espacios.</p>
                </div>

                {!usePhone ? (
                  <div className="pt-6 space-y-4">
                    <button 
                      type="button" 
                      onClick={handleGoogleAuth}
                      disabled={loading} 
                      className="w-full flex justify-center items-center gap-3 py-4 px-4 rounded-2xl shadow-lg text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loading ? <Loader2 className="animate-spin text-slate-400" /> : (
                        <>
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Crear Instancia con Google
                        </>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setUsePhone(true)}
                      disabled={loading} 
                      className="w-full flex justify-center items-center gap-3 py-4 px-4 border border-slate-600/50 rounded-2xl text-sm font-bold text-white bg-slate-800/80 hover:bg-slate-700 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      <Smartphone className="w-5 h-5 text-purple-400" />
                      O usa tu Número de Teléfono
                    </button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-slate-700/50 mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">Teléfono Móvil</label>
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block w-full px-4 py-4 border border-slate-700/50 rounded-2xl focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-slate-900/50 text-white transition-all outline-none font-semibold" 
                        placeholder="+52 55 1234 5678" 
                      />
                      <p className="text-[0.65rem] text-slate-500 mt-2 ml-2">Asegúrate de incluir el código de país (ej. +52).</p>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        type="button" 
                        onClick={() => setUsePhone(false)}
                        className="p-4 border border-slate-600/50 rounded-2xl text-slate-400 hover:text-white bg-slate-800/80 transition-all"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <button 
                        type="button" 
                        onClick={handleSendSMS}
                        disabled={loading} 
                        className="flex-1 flex justify-center items-center gap-3 py-4 px-4 rounded-2xl shadow-lg shadow-purple-900/20 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : "Enviar SMS de Código"}
                      </button>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-center text-slate-500 mt-6 flex items-center justify-center gap-1.5 font-medium">
                  <ShieldCheck size={14} className="text-emerald-500" /> Tu información está cifrada.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/10 border border-indigo-500/30">
                <Smartphone className="text-indigo-400" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">Verifica tu Teléfono</h2>
              <p className="text-slate-400 text-sm mb-8 font-medium">Hemos enviado un código SMS al {phone}.</p>

              {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-xl mb-6 text-sm font-bold border border-red-500/30">{error}</div>}

              <div className="space-y-6">
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="block w-full text-center tracking-[0.5em] text-3xl px-4 py-4 border border-slate-700/50 rounded-2xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-900/50 text-white transition-all outline-none font-black" 
                  placeholder="000000" 
                />

                <button 
                  type="button" 
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 6} 
                  className="w-full flex justify-center items-center gap-3 py-4 px-4 rounded-2xl shadow-lg shadow-indigo-900/20 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Verificar y Crear Instancia"}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="text-emerald-400" size={40} />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">¡Instancia Creada!</h2>
              <p className="text-slate-400 mb-10 font-medium">Tu ERP y tienda online han sido generados exitosamente. Tu cuenta ha sido configurada como Propietario.</p>
              
              <button 
                onClick={() => {
                  useERPStore.getState().startGuidedTour();
                  router.push('/dashboard');
                }}
                className="w-full flex justify-center py-4 px-4 rounded-2xl shadow-lg shadow-purple-900/20 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all active:scale-[0.98]"
              >
                Entrar al Sistema (Onboarding)
              </button>
            </motion.div>
          )}

          {/* Invisible recaptcha container */}
          <div id="recaptcha-container"></div>
        </motion.div>
      </div>
    </main>
  );
}
