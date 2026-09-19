/**
 * OMNIPULSE — Definiciones de Tipos Compartidos
 * Tipos para las 15 redes sociales, cuentas, publicaciones y estados.
 */

export type NetworkId =
    | 'facebook'
    | 'instagram'
    | 'threads'
    | 'linkedin_personal'
    | 'linkedin_company'
    | 'youtube'
    | 'pinterest'
    | 'telegram'
    | 'discord'
    | 'whatsapp'
    | 'twitter'
    | 'tiktok'
    | 'bluesky'
    | 'mastodon'
    | 'reddit'
    | 'tumblr';

export type DispatchStatus = 'pending' | 'publishing' | 'success' | 'failed' | 'skipped' | 'rate_limited';
export type PostStatus = 'draft' | 'queued' | 'publishing' | 'done' | 'partial_failure';

export interface NetworkMeta {
    id: NetworkId;
    name: string;
    color: string;          // Color corporativo de la red
    icon: string;           // Emoji o icono (para el UI sin librería externa)
    group: 'A' | 'B' | 'C';
    authType: 'oauth2' | 'token' | 'open_protocol';
    charLimit: number;      // Límite de caracteres por publicación
    supportsMedia: boolean;
    supportsVideo: boolean;
}

/** Metadata estática de todas las redes soportadas */
export const NETWORKS: Record<NetworkId, NetworkMeta> = {
    facebook:          { id: 'facebook',          name: 'Facebook',        color: '#1877F2', icon: '📘', group: 'A', authType: 'oauth2',         charLimit: 63206, supportsMedia: true,  supportsVideo: true  },
    instagram:         { id: 'instagram',          name: 'Instagram',       color: '#E1306C', icon: '📷', group: 'A', authType: 'oauth2',         charLimit: 2200,  supportsMedia: true,  supportsVideo: true  },
    threads:           { id: 'threads',            name: 'Threads',         color: '#000000', icon: '🧵', group: 'A', authType: 'oauth2',         charLimit: 500,   supportsMedia: true,  supportsVideo: true  },
    linkedin_personal: { id: 'linkedin_personal',  name: 'LinkedIn (Perfil)',color: '#0A66C2', icon: '💼', group: 'A', authType: 'oauth2',         charLimit: 3000,  supportsMedia: true,  supportsVideo: true  },
    linkedin_company:  { id: 'linkedin_company',   name: 'LinkedIn (Empresa)',color: '#0A66C2', icon: '🏢', group: 'A', authType: 'oauth2',        charLimit: 3000,  supportsMedia: true,  supportsVideo: true  },
    youtube:           { id: 'youtube',            name: 'YouTube Community',color: '#FF0000', icon: '▶️', group: 'A', authType: 'oauth2',         charLimit: 5000,  supportsMedia: true,  supportsVideo: false },
    pinterest:         { id: 'pinterest',          name: 'Pinterest',       color: '#E60023', icon: '📌', group: 'A', authType: 'oauth2',         charLimit: 500,   supportsMedia: true,  supportsVideo: false },
    telegram:          { id: 'telegram',           name: 'Telegram',        color: '#26A5E4', icon: '✈️', group: 'B', authType: 'token',          charLimit: 4096,  supportsMedia: true,  supportsVideo: true  },
    discord:           { id: 'discord',            name: 'Discord',         color: '#5865F2', icon: '🎮', group: 'B', authType: 'token',          charLimit: 2000,  supportsMedia: true,  supportsVideo: true  },
    whatsapp:          { id: 'whatsapp',           name: 'WhatsApp',        color: '#25D366', icon: '💬', group: 'B', authType: 'token',          charLimit: 65536, supportsMedia: true,  supportsVideo: true  },
    twitter:           { id: 'twitter',            name: 'X / Twitter',     color: '#000000', icon: '✖️', group: 'C', authType: 'open_protocol',  charLimit: 280,   supportsMedia: true,  supportsVideo: true  },
    tiktok:            { id: 'tiktok',             name: 'TikTok',          color: '#FF0050', icon: '🎵', group: 'C', authType: 'oauth2',         charLimit: 2200,  supportsMedia: false, supportsVideo: true  },
    bluesky:           { id: 'bluesky',            name: 'Bluesky',         color: '#0085FF', icon: '🦋', group: 'C', authType: 'open_protocol',  charLimit: 300,   supportsMedia: true,  supportsVideo: false },
    mastodon:          { id: 'mastodon',           name: 'Mastodon',        color: '#6364FF', icon: '🐘', group: 'C', authType: 'open_protocol',  charLimit: 500,   supportsMedia: true,  supportsVideo: false },
    reddit:            { id: 'reddit',             name: 'Reddit',          color: '#FF4500', icon: '👾', group: 'C', authType: 'open_protocol',  charLimit: 40000, supportsMedia: true,  supportsVideo: false },
    tumblr:            { id: 'tumblr',             name: 'Tumblr',          color: '#35465C', icon: '📓', group: 'C', authType: 'open_protocol',  charLimit: 4096,  supportsMedia: true,  supportsVideo: false },
};

/** Resumen de una cuenta conectada (sin exponer tokens) */
export interface OmniAccountSummary {
    id: string;
    network: NetworkId;
    accountName: string;
    accountId: string;
    isActive: boolean;
    isTokenValid: boolean;
    expiresAt: string | null;
    createdAt: string;
}

/** Estado de una publicación por red durante el despacho */
export interface DispatchResult {
    accountId: string;
    network: NetworkId;
    accountName: string;
    status: DispatchStatus;
    externalId?: string;
    errorMsg?: string;
    publishedAt?: string;
}

/** Payload para crear una nueva publicación */
export interface CreatePostPayload {
    body: string;           // Texto principal (puede contener Spintax)
    hashtags?: string;
    mediaUrls?: string[];   // URLs de imágenes subidas previamente
    accountIds: string[];   // IDs de OmniAccount destino
    scheduledAt?: string;   // ISO 8601 para publicación programada
    useSpintax?: boolean;
}
