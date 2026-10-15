"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedLanguage = 'es' | 'en' | 'fr' | 'zh';

export interface LanguageContextType {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    t: (key: string, fallback?: string) => string;
}

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
    es: {
        // Navigation & Admin
        'nav.dashboard': 'Dashboard General',
        'nav.sales': 'Control de Ventas',
        'nav.pos': 'Punto de Venta POS',
        'nav.inventory': 'Almacén & Stock',
        'nav.patio': 'Patio & Carga',
        'nav.delivery': 'Logística & Rutas',
        'nav.pickup': 'Recolección en Tienda',
        'nav.users': 'Usuarios & Roles',
        'nav.customers': 'Clientes & CRM',
        'nav.reports': 'Reportes & Balances',
        'nav.billing': 'Facturación SAT CFDI',
        'nav.audit': 'Registro de Auditoría',
        'nav.design': 'Diseño & Marca',
        'nav.marketing': 'Marketing & Campañas',
        'nav.qr': 'Vincular por QR',
        'nav.demo': 'Test ISO / Demo',
        'nav.subscription': 'Suscripción & Plan',
        'nav.guia': 'Guía del Dueño',
        'nav.market': 'Salir al Market',
        'nav.profile': 'Mi Perfil',
        'nav.logout': 'Cerrar Sesión',
        'nav.back': 'Atrás',
        'nav.panel': 'PANEL',

        // System status
        'status.online': 'SISTEMA ONLINE',
        'status.offline': 'MODO LOCAL / OFFLINE',
        'status.connecting': 'CONECTANDO…',
        'status.premium_active': 'PREMIUM ACTIVO',
        'status.basic': 'BÁSICO',
        'status.demo_warning': 'MODO DEMOSTRACIÓN: Usted está en modo de solo lectura.',

        // Walkie Talkie & Radio
        'radio.hold_to_talk': 'Mantén presionado para hablar (o usa la barra espaciadora)',
        'radio.lan_ptt': 'Radio LAN · PTT (Espacio)',
        'radio.connecting': 'Conectando radio local…',
        'radio.offline': 'Radio local offline · inicia radio-server.js',
        'radio.mic_denied': 'Permiso de micrófono denegado.',
        'radio.no_mic': 'No se detectó ningún micrófono.',

        // AI Assistant
        'ai.manager_ready': '⚡ Reporte Gerencial Listo',
        'ai.help_prompt': '¡Hola! ¿Necesitas ayuda? 👋',
        'ai.title_owner': 'LION — GERENTE INTELIGENTE',
        'ai.title_client': 'LION — ASISTENTE VIRTUAL',
        'ai.input_placeholder': 'Consulta métricas, inventario o alertas...',

        // Actions & Buttons
        'action.save': 'Guardar',
        'action.cancel': 'Cancelar',
        'action.delete': 'Eliminar',
        'action.edit': 'Editar',
        'action.search': 'Buscar',
        'action.filter': 'Filtrar',
        'action.close': 'Cerrar',
        'action.open': 'Abrir',
        'action.download': 'Descargar',
        'action.print': 'Imprimir',
        'action.refresh': 'Actualizar',

        // Monetary & Cart
        'money.total': 'Total',
        'money.subtotal': 'Subtotal',
        'money.tax': 'Impuestos',
        'money.cash': 'Efectivo',
        'money.card': 'Tarjeta',
        'money.transfer': 'Transferencia',
        'money.change': 'Cambio',
        'money.received': 'Recibido',
        'money.expected': 'Monto Esperado',
        'money.discrepancy': 'Discrepancia'
    },
    en: {
        // Navigation & Admin
        'nav.dashboard': 'General Dashboard',
        'nav.sales': 'Sales Management',
        'nav.pos': 'Point of Sale (POS)',
        'nav.inventory': 'Warehouse & Stock',
        'nav.patio': 'Yard & Loading Bay',
        'nav.delivery': 'Logistics & Routes',
        'nav.pickup': 'In-Store Pickup',
        'nav.users': 'Users & Roles',
        'nav.customers': 'Customers & CRM',
        'nav.reports': 'Reports & Balances',
        'nav.billing': 'Electronic Invoicing',
        'nav.audit': 'Immutable Audit Log',
        'nav.design': 'Branding & Design',
        'nav.marketing': 'Marketing & Ads',
        'nav.qr': 'Connect via QR',
        'nav.demo': 'ISO Test / Demo',
        'nav.subscription': 'Subscription & Plan',
        'nav.guia': 'Owner Manual',
        'nav.market': 'Exit to Store',
        'nav.profile': 'My Profile',
        'nav.logout': 'Sign Out',
        'nav.back': 'Back',
        'nav.panel': 'DASHBOARD',

        // System status
        'status.online': 'SYSTEM ONLINE',
        'status.offline': 'LOCAL / OFFLINE MODE',
        'status.connecting': 'CONNECTING…',
        'status.premium_active': 'PREMIUM ACTIVE',
        'status.basic': 'BASIC',
        'status.demo_warning': 'DEMO MODE: You are in read-only mode.',

        // Walkie Talkie & Radio
        'radio.hold_to_talk': 'Hold to talk (or use Spacebar)',
        'radio.lan_ptt': 'LAN Radio · PTT (Space)',
        'radio.connecting': 'Connecting local radio…',
        'radio.offline': 'Local radio offline · start radio-server.js',
        'radio.mic_denied': 'Microphone permission denied.',
        'radio.no_mic': 'No microphone detected.',

        // AI Assistant
        'ai.manager_ready': '⚡ Executive Report Ready',
        'ai.help_prompt': 'Hello! Need assistance? 👋',
        'ai.title_owner': 'LION — SMART MANAGER',
        'ai.title_client': 'LION — VIRTUAL ASSISTANT',
        'ai.input_placeholder': 'Ask metrics, inventory, or alerts...',

        // Actions & Buttons
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.delete': 'Delete',
        'action.edit': 'Edit',
        'action.search': 'Search',
        'action.filter': 'Filter',
        'action.close': 'Close',
        'action.open': 'Open',
        'action.download': 'Download',
        'action.print': 'Print',
        'action.refresh': 'Refresh',

        // Monetary & Cart
        'money.total': 'Total',
        'money.subtotal': 'Subtotal',
        'money.tax': 'Taxes',
        'money.cash': 'Cash',
        'money.card': 'Card',
        'money.transfer': 'Bank Wire',
        'money.change': 'Change',
        'money.received': 'Received',
        'money.expected': 'Expected Amount',
        'money.discrepancy': 'Discrepancy'
    },
    fr: {
        // Navigation & Admin
        'nav.dashboard': 'Tableau de Bord',
        'nav.sales': 'Gestion des Ventes',
        'nav.pos': 'Point de Vente (POS)',
        'nav.inventory': 'Entrepôt & Stock',
        'nav.patio': 'Cour & Chargement',
        'nav.delivery': 'Logistique & Livraisons',
        'nav.pickup': 'Retrait en Magasin',
        'nav.users': 'Utilisateurs & Rôles',
        'nav.customers': 'Clients & CRM',
        'nav.reports': 'Rapports & Bilans',
        'nav.billing': 'Facturation Fiscale',
        'nav.audit': 'Registre d’Audit',
        'nav.design': 'Design & Marque',
        'nav.marketing': 'Marketing & Campagnes',
        'nav.qr': 'Liaison QR Mobile',
        'nav.demo': 'Test ISO / Démo',
        'nav.subscription': 'Abonnement & Forfait',
        'nav.guia': 'Guide du Propriétaire',
        'nav.market': 'Aller au Magasin',
        'nav.profile': 'Mon Profil',
        'nav.logout': 'Déconnexion',
        'nav.back': 'Retour',
        'nav.panel': 'PANNEAU',

        // System status
        'status.online': 'SYSTÈME EN LIGNE',
        'status.offline': 'MODE LOCAL / HORS LIGNE',
        'status.connecting': 'CONNEXION…',
        'status.premium_active': 'PREMIUM ACTIF',
        'status.basic': 'BASIQUE',
        'status.demo_warning': 'MODE DÉMO: Vous êtes en mode lecture seule.',

        // Walkie Talkie & Radio
        'radio.hold_to_talk': 'Maintenez pour parler (ou barre espace)',
        'radio.lan_ptt': 'Radio LAN · PTT (Espace)',
        'radio.connecting': 'Connexion radio locale…',
        'radio.offline': 'Radio locale hors ligne · lancez radio-server.js',
        'radio.mic_denied': 'Accès au microphone refusé.',
        'radio.no_mic': 'Aucun microphone détecté.',

        // AI Assistant
        'ai.manager_ready': '⚡ Rapport de Direction Prêt',
        'ai.help_prompt': 'Bonjour! Besoin d’aide? 👋',
        'ai.title_owner': 'LION — GÉRANT INTELLIGENT',
        'ai.title_client': 'LION — ASSISTANT VIRTUEL',
        'ai.input_placeholder': 'Consultez métriques, stock ou alertes...',

        // Actions & Buttons
        'action.save': 'Enregistrer',
        'action.cancel': 'Annuler',
        'action.delete': 'Supprimer',
        'action.edit': 'Modifier',
        'action.search': 'Rechercher',
        'action.filter': 'Filtrer',
        'action.close': 'Fermer',
        'action.open': 'Ouvrir',
        'action.download': 'Télécharger',
        'action.print': 'Imprimer',
        'action.refresh': 'Actualiser',

        // Monetary & Cart
        'money.total': 'Total',
        'money.subtotal': 'Sous-total',
        'money.tax': 'Taxes',
        'money.cash': 'Espèces',
        'money.card': 'Carte',
        'money.transfer': 'Virement Bancaire',
        'money.change': 'Monnaie',
        'money.received': 'Reçu',
        'money.expected': 'Montant Attendu',
        'money.discrepancy': 'Écart'
    },
    zh: {
        // Navigation & Admin
        'nav.dashboard': '总控制面板',
        'nav.sales': '销售管理',
        'nav.pos': '收银台 (POS)',
        'nav.inventory': '仓库与库存',
        'nav.patio': '货场装卸区',
        'nav.delivery': '物流与配送',
        'nav.pickup': '门店自提',
        'nav.users': '用户与权限',
        'nav.customers': '客户与CRM',
        'nav.reports': '报表与结算',
        'nav.billing': '电子发票管理',
        'nav.audit': '不可变审计日志',
        'nav.design': '品牌与外观',
        'nav.marketing': '营销与推广',
        'nav.qr': '二维码配对',
        'nav.demo': 'ISO测试 / 演示',
        'nav.subscription': '会员与计划',
        'nav.guia': '业主操作指南',
        'nav.market': '前往商城',
        'nav.profile': '个人主页',
        'nav.logout': '退出登录',
        'nav.back': '返回',
        'nav.panel': '控制台',

        // System status
        'status.online': '系统在线',
        'status.offline': '本地离线模式',
        'status.connecting': '连接中…',
        'status.premium_active': '高级版已激活',
        'status.basic': '基础版',
        'status.demo_warning': '演示模式：您处于只读状态。',

        // Walkie Talkie & Radio
        'radio.hold_to_talk': '按住说话（或长按空格键）',
        'radio.lan_ptt': '局域网对讲机 · PTT (空格)',
        'radio.connecting': '正在连接本地对讲机…',
        'radio.offline': '本地对讲机离线 · 请启动 radio-server.js',
        'radio.mic_denied': '麦克风权限被拒绝。',
        'radio.no_mic': '未检测到麦克风。',

        // AI Assistant
        'ai.manager_ready': '⚡ 管理层报告已就绪',
        'ai.help_prompt': '您好！需要协助吗？ 👋',
        'ai.title_owner': 'LION — 智能运营总监',
        'ai.title_client': 'LION — 智能助手',
        'ai.input_placeholder': '查询营业额、库存或预警信息...',

        // Actions & Buttons
        'action.save': '保存',
        'action.cancel': '取消',
        'action.delete': '删除',
        'action.edit': '编辑',
        'action.search': '搜索',
        'action.filter': '筛选',
        'action.close': '关闭',
        'action.open': '打开',
        'action.download': '下载',
        'action.print': '打印',
        'action.refresh': '刷新',

        // Monetary & Cart
        'money.total': '总计',
        'money.subtotal': '小计',
        'money.tax': '税费',
        'money.cash': '现金',
        'money.card': '刷卡',
        'money.transfer': '银行转账',
        'money.change': '找零',
        'money.received': '实收',
        'money.expected': '应收金额',
        'money.discrepancy': '差额'
    }
};

const LanguageContext = createContext<LanguageContextType>({
    language: 'es',
    setLanguage: () => {},
    t: (key: string, fallback?: string) => fallback || key
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<SupportedLanguage>('es');

    useEffect(() => {
        try {
            const saved = localStorage.getItem('bunkker_language') as SupportedLanguage;
            if (saved && (saved === 'es' || saved === 'en' || saved === 'fr' || saved === 'zh')) {
                setLanguageState(saved);
            }
        } catch (e) {
            // Ignore SSR or restricted storage errors
        }
    }, []);

    const setLanguage = (lang: SupportedLanguage) => {
        setLanguageState(lang);
        try {
            localStorage.setItem('bunkker_language', lang);
            document.documentElement.lang = lang;
        } catch (e) {}
    };

    const t = (key: string, fallback?: string): string => {
        const langMap = TRANSLATIONS[language] || TRANSLATIONS['es'];
        if (langMap && langMap[key]) {
            return langMap[key];
        }
        // Fallback to Spanish dictionary
        if (TRANSLATIONS['es'][key]) {
            return TRANSLATIONS['es'][key];
        }
        return fallback || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

export function useTranslation() {
    return useContext(LanguageContext);
}
