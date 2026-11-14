"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { isWebNfcSupported, parseNfcPayload, type ParsedNfcTag } from '@/lib/hardwareConfig';

export interface UseNfcScannerOptions {
    enabled?: boolean;
    onRead?: (tag: ParsedNfcTag) => void;
    onError?: (message: string) => void;
}

interface NdefReadingEventLike {
    serialNumber?: string;
    message?: {
        records?: Array<{
            recordType?: string;
            encoding?: string;
            data?: DataView | ArrayBuffer;
        }>;
    };
}

function decodeNdefRecords(event: NdefReadingEventLike): string[] {
    const records = event?.message?.records || [];
    const decoded: string[] = [];

    for (const record of records) {
        if (!record?.data) continue;
        try {
            const encoding = record.encoding || 'utf-8';
            const decoder = new TextDecoder(encoding);
            const buffer = record.data instanceof DataView
                ? new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength)
                : new Uint8Array(record.data);
            const text = decoder.decode(buffer).replace(/\0/g, '').trim();
            if (text) decoded.push(text);
        } catch {
            // ignore undecodable binary records
        }
    }

    return decoded;
}

export function useNfcScanner(options: UseNfcScannerOptions = {}) {
    const { enabled = false, onRead, onError } = options;
    const [supported, setSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [lastTag, setLastTag] = useState<ParsedNfcTag | null>(null);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const onReadRef = useRef(onRead);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onReadRef.current = onRead;
        onErrorRef.current = onError;
    }, [onRead, onError]);

    useEffect(() => {
        setSupported(isWebNfcSupported());
    }, []);

    const stopScan = useCallback(() => {
        if (abortRef.current) {
            try {
                abortRef.current.abort();
            } catch {
                // ignore abort errors
            }
            abortRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startScan = useCallback(async (): Promise<boolean> => {
        if (!isWebNfcSupported()) {
            const msg = 'Web NFC requiere Chrome en Android con HTTPS. Usa un lector USB HID NFC en escritorio.';
            setError(msg);
            onErrorRef.current?.(msg);
            return false;
        }

        stopScan();
        const controller = new AbortController();
        abortRef.current = controller;
        setError(null);

        try {
            const NDEFReaderCtor = (window as any).NDEFReader;
            const reader = new NDEFReaderCtor();

            reader.addEventListener(
                'reading',
                (ev: NdefReadingEventLike) => {
                    const texts = decodeNdefRecords(ev);
                    const parsed = parseNfcPayload(texts, ev?.serialNumber);
                    if (parsed.code) {
                        setLastTag(parsed);
                        onReadRef.current?.(parsed);
                    }
                },
                { signal: controller.signal }
            );

            reader.addEventListener(
                'readingerror',
                () => {
                    const msg = 'No se pudo leer el tag NFC. Acerca la tarjeta nuevamente.';
                    setError(msg);
                    onErrorRef.current?.(msg);
                },
                { signal: controller.signal }
            );

            await reader.scan({ signal: controller.signal });
            setIsListening(true);
            return true;
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                setIsListening(false);
                return false;
            }
            const msg = err?.message || 'Permiso NFC denegado o sensor desactivado.';
            setError(msg);
            setIsListening(false);
            onErrorRef.current?.(msg);
            return false;
        }
    }, [stopScan]);

    useEffect(() => {
        if (!enabled) {
            stopScan();
        }
        return () => stopScan();
    }, [enabled, stopScan]);

    return {
        supported,
        isListening,
        lastTag,
        error,
        startScan,
        stopScan,
    };
}
