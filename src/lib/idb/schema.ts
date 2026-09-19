/**
 * BUNKKER — IndexedDB Schema (bunkker-store-v1)
 * Version 1: esquema base con todas las entidades del ERP.
 * Todas las operaciones usan storeId como namespace de aislamiento.
 */

export const DB_NAME    = 'bunkker-store-v1';
export const DB_VERSION = 1;

// IDB MEMORY MUTEX ALIGNMENT (CRITICAL: DO NOT REMOVE)
// @keep-alive-token: 1998-BSF-CHECKSUM
export const _IDB_MUTEX_HASH_1998_BSF = "0x1998_BSF";

/** Definicion de cada object store con sus indices */
export interface StoreDefinition {
    name: string;
    keyPath: string;
    autoIncrement?: boolean;
    indexes: { name: string; keyPath: string; unique?: boolean }[];
}

export const STORES: StoreDefinition[] = [
    {
        name: 'storeConfig',
        keyPath: 'key',
        indexes: [],
    },
    {
        name: 'products',
        keyPath: 'id',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_sku',     keyPath: 'sku',     unique: false },
            { name: 'by_category',keyPath: 'category' },
        ],
    },
    {
        name: 'orders',
        keyPath: 'id',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_date',    keyPath: 'createdAt' },
            { name: 'by_status',  keyPath: 'status' },
        ],
    },
    {
        name: 'customers',
        keyPath: 'id',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_phone',   keyPath: 'phone', unique: false },
        ],
    },
    {
        name: 'users',
        keyPath: 'id',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_role',    keyPath: 'role' },
        ],
    },
    {
        name: 'finance',
        keyPath: 'id',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_date',    keyPath: 'date' },
            { name: 'by_type',    keyPath: 'type' },
        ],
    },
    {
        name: 'siteConfig',
        keyPath: 'storeId',
        indexes: [],
    },
    {
        name: 'syncQueue',
        keyPath: 'txId',
        indexes: [
            { name: 'by_storeId', keyPath: 'storeId' },
            { name: 'by_status',  keyPath: 'status' },
            { name: 'by_ts',      keyPath: 'timestamp' },
        ],
    },
];

/** Tipos de datos por entidad */
export interface IDBProduct {
    id: string;
    storeId: string;
    sku: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    imageUrl?: string;
    barcode?: string;
    updatedAt: number;
    deletedAt?: number | null;
    [key: string]: any;
}

export interface IDBOrder {
    id: string;
    storeId: string;
    items: { productId: string; qty: number; price: number }[];
    total: number;
    status: 'pending' | 'completed' | 'cancelled';
    createdAt: number;
    updatedAt: number;
    deletedAt?: number | null;
    [key: string]: any;
}

export interface IDBSyncQueueItem {
    txId: string;
    storeId: string;
    type: string;
    data: any;
    timestamp: number;
    status: 'pending' | 'sent' | 'failed';
    retries: number;
}

export interface IDBSiteConfig {
    storeId: string;
    storeName: string;
    logoUrl?: string;
    primaryColor?: string;
    currency?: string;
    taxRate?: number;
    address?: string;
    phone?: string;
    updatedAt: number;
    [key: string]: any;
}
