"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast';

export type WeightUnit = 'kg' | 'g' | 'lb';

export interface BluetoothScaleState {
    isConnected: boolean;
    isConnecting: boolean;
    isSimulated: boolean;
    deviceName: string | null;
    weight: number;
    grossWeight: number;
    tareWeight: number;
    unit: WeightUnit;
    isStable: boolean;
    error: string | null;
    connectionType: 'bluetooth' | 'serial' | 'simulated' | 'none';
}

// UUIDs estándar de Básculas Bluetooth (GATT Weight Scale y Nordic UART SPP)
const BLE_WEIGHT_SCALE_SERVICE = 0x181D;
const BLE_WEIGHT_MEASUREMENT_CHAR = 0x2A98;
const BLE_NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NORDIC_RX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export function useBluetoothScale() {
    const [state, setState] = useState<BluetoothScaleState>({
        isConnected: false,
        isConnecting: false,
        isSimulated: false,
        deviceName: null,
        weight: 0.0,
        grossWeight: 0.0,
        tareWeight: 0.0,
        unit: 'kg',
        isStable: true,
        error: null,
        connectionType: 'none',
    });

    const deviceRef = useRef<any>(null);
    const serverRef = useRef<any>(null);
    const portRef = useRef<any>(null);
    const simulatedTimerRef = useRef<any>(null);

    // Cargar tara guardada si existe
    useEffect(() => {
        try {
            const savedUnit = localStorage.getItem('_bunkker_scale_unit') as WeightUnit;
            if (savedUnit) {
                setState(prev => ({ ...prev, unit: savedUnit }));
            }
        } catch {}
    }, []);

    // Parseador estándar de paquetes de peso BLE (IEEE-11073 o ASCII de básculas de mostrador)
    const parseWeightData = useCallback((dataView: DataView) => {
        try {
            // Caso 1: Típico paquete ASCII transmitido por básculas de puerto serial BLE ("ST,GS,+   1.250kg\r\n" o " 0.525 kg")
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(dataView).trim();
            const asciiMatch = text.match(/([-+]?[0-9]*\.?[0-9]+)/);
            if (asciiMatch) {
                const parsedVal = parseFloat(asciiMatch[1]);
                if (!isNaN(parsedVal)) {
                    setState(prev => {
                        const net = Math.max(0, parsedVal - prev.tareWeight);
                        return {
                            ...prev,
                            grossWeight: parsedVal,
                            weight: Number(net.toFixed(3)),
                            isStable: !text.includes('US') // US = Unstable en protocolos Torrey/Rhino
                        };
                    });
                    return;
                }
            }

            // Caso 2: GATT Weight Scale Standard (0x181D / 0x2A98)
            // Byte 0: Flags (Bit 0: 0=kg/g, 1=lbs)
            const flags = dataView.getUint8(0);
            const isLbs = (flags & 0x01) !== 0;
            // Bytes 1-2: Peso en uint16 con resolución configurable (típico 0.005 o 0.01 kg)
            const rawWeight = dataView.getUint16(1, true);
            const resolution = isLbs ? 0.01 : 0.005;
            const calculatedKg = Number((rawWeight * resolution).toFixed(3));

            setState(prev => {
                const net = Math.max(0, calculatedKg - prev.tareWeight);
                return {
                    ...prev,
                    grossWeight: calculatedKg,
                    weight: Number(net.toFixed(3)),
                    unit: isLbs ? 'lb' : 'kg',
                    isStable: true
                };
            });
        } catch (e) {
            console.warn('[Báscula] Error interpretando trama de peso:', e);
        }
    }, []);

    // Conexión Web Bluetooth
    const connectBluetooth = async () => {
        if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
            toast.error('Tu navegador no soporta Web Bluetooth. Usa Google Chrome o Microsoft Edge.');
            return false;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [
                    { services: [BLE_WEIGHT_SCALE_SERVICE] },
                    { services: [BLE_NORDIC_UART_SERVICE] },
                    { namePrefix: 'Scale' },
                    { namePrefix: 'BASCULA' },
                    { namePrefix: 'TORREY' },
                    { namePrefix: 'RHINO' },
                    { namePrefix: 'BLE' },
                ],
                optionalServices: [
                    BLE_WEIGHT_SCALE_SERVICE,
                    BLE_NORDIC_UART_SERVICE,
                    'generic_access',
                    'battery_service'
                ]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', onDisconnected);

            const server = await device.gatt.connect();
            serverRef.current = server;

            // Intentar suscribir al servicio de báscula
            let characteristic: any = null;
            try {
                const service = await server.getPrimaryService(BLE_WEIGHT_SCALE_SERVICE);
                characteristic = await service.getCharacteristic(BLE_WEIGHT_MEASUREMENT_CHAR);
            } catch {
                // Probar Nordic UART SPP
                const service = await server.getPrimaryService(BLE_NORDIC_UART_SERVICE);
                characteristic = await service.getCharacteristic(BLE_NORDIC_RX_CHAR);
            }

            if (characteristic) {
                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                    parseWeightData(event.target.value);
                });
            }

            setState(prev => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
                deviceName: device.name || 'Báscula Bluetooth',
                connectionType: 'bluetooth',
                isSimulated: false,
            }));

            toast.success(`Báscula conectada: ${device.name || 'Bluetooth'}`);
            return true;
        } catch (err: any) {
            if (err.name !== 'NotFoundError') { // El usuario canceló la selección de dispositivo
                console.error('Error conectando báscula BLE:', err);
                toast.error(`No se pudo conectar: ${err.message || 'Error desconocido'}`);
            }
            setState(prev => ({ ...prev, isConnecting: false, error: err.message }));
            return false;
        }
    };

    // Conexión Web Serial (para básculas de cable USB/RS232 en mostrador)
    const connectSerial = async () => {
        if (typeof navigator === 'undefined' || !(navigator as any).serial) {
            toast.error('Tu navegador no soporta Web Serial. Usa Chrome o Edge.');
            return false;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 9600 });
            portRef.current = port;

            const reader = port.readable.getReader();

            // Loop de lectura serial en background
            (async () => {
                const decoder = new TextDecoder();
                let buffer = '';
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value);
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                            const match = line.match(/([-+]?[0-9]*\.?[0-9]+)/);
                            if (match) {
                                const parsed = parseFloat(match[1]);
                                if (!isNaN(parsed)) {
                                    setState(prev => {
                                        const net = Math.max(0, parsed - prev.tareWeight);
                                        return {
                                            ...prev,
                                            grossWeight: parsed,
                                            weight: Number(net.toFixed(3)),
                                            isStable: true
                                        };
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Lector serial cerrado', e);
                } finally {
                    reader.releaseLock();
                }
            })();

            setState(prev => ({
                ...prev,
                isConnected: true,
                isConnecting: false,
                deviceName: 'Báscula Serial USB',
                connectionType: 'serial',
                isSimulated: false,
            }));

            toast.success('Báscula Serial USB conectada');
            return true;
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error(`Error serial: ${err.message}`);
            }
            setState(prev => ({ ...prev, isConnecting: false, error: err.message }));
            return false;
        }
    };

    // Modo simulado / prueba rápida para testing en desarrollo o cuando no hay hardware físico conectado
    const toggleSimulated = (enable?: boolean) => {
        const shouldEnable = enable !== undefined ? enable : !state.isSimulated;
        
        if (simulatedTimerRef.current) {
            clearInterval(simulatedTimerRef.current);
            simulatedTimerRef.current = null;
        }

        if (shouldEnable) {
            setState(prev => ({
                ...prev,
                isConnected: true,
                isSimulated: true,
                deviceName: 'Báscula Virtual BUNKKER',
                connectionType: 'simulated',
                weight: 1.250,
                grossWeight: 1.250,
                isStable: true
            }));
            toast.info('Báscula virtual activada para pruebas rápidas.');
        } else {
            setState(prev => ({
                ...prev,
                isConnected: false,
                isSimulated: false,
                deviceName: null,
                connectionType: 'none',
                weight: 0,
                grossWeight: 0
            }));
        }
    };

    // Poner peso manual en modo virtual o rápido
    const setManualWeight = (val: number) => {
        const clean = Math.max(0, Number(val.toFixed(3)));
        setState(prev => ({
            ...prev,
            weight: clean,
            grossWeight: clean + prev.tareWeight,
            isStable: true
        }));
    };

    // Tarar la báscula a 0.00
    const tare = () => {
        setState(prev => ({
            ...prev,
            tareWeight: prev.grossWeight,
            weight: 0.000
        }));
        toast.success('Báscula tarada a 0.000 kg');
    };

    // Cambiar unidad (kg / g / lb)
    const setUnit = (unit: WeightUnit) => {
        setState(prev => ({ ...prev, unit }));
        try {
            localStorage.setItem('_bunkker_scale_unit', unit);
        } catch {}
    };

    const onDisconnected = () => {
        setState(prev => ({
            ...prev,
            isConnected: false,
            deviceName: null,
            connectionType: 'none'
        }));
        toast.warning('Báscula desconectada');
    };

    const disconnect = () => {
        if (deviceRef.current && deviceRef.current.gatt.connected) {
            deviceRef.current.gatt.disconnect();
        }
        if (portRef.current) {
            portRef.current.close().catch(() => {});
            portRef.current = null;
        }
        if (simulatedTimerRef.current) {
            clearInterval(simulatedTimerRef.current);
            simulatedTimerRef.current = null;
        }
        setState(prev => ({
            ...prev,
            isConnected: false,
            isSimulated: false,
            deviceName: null,
            connectionType: 'none',
            weight: 0,
            grossWeight: 0
        }));
        toast.info('Báscula desconectada');
    };

    return {
        ...state,
        connectBluetooth,
        connectSerial,
        toggleSimulated,
        setManualWeight,
        tare,
        setUnit,
        disconnect,
    };
}
