import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export interface LocationData {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}

export function useDriverGPS(isActive: boolean) {
    const { profile } = useAuth();
    const [location, setLocation] = useState<LocationData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isActive || !profile || profile.role !== 'driver') return;

        if (!('geolocation' in navigator)) {
            setError('Geolocalización no soportada por el dispositivo.');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const locData: LocationData = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                };

                setLocation(locData);
                setError(null);

                // Enviar silenciosamente a Firebase
                try {
                    await setDoc(doc(db, 'tracking_fleet', profile.uid), {
                        ...locData,
                        driverName: profile.displayName,
                        lastUpdated: new Date().toISOString()
                    }, { merge: true });
                } catch (err) {
                    console.error("Error transmitiendo GPS:", err);
                }
            },
            (err) => {
                setError(err.message);
                console.error("GPS Error:", err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 5000
            }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, [isActive, profile]);

    return { location, error };
}
