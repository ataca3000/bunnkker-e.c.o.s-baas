"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Truck } from 'lucide-react';

// Solución al problema de los íconos por defecto de Leaflet en Next.js
const driverIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830180.png', // Icono de camión
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

export default function AdminRadarMap() {
    const [fleet, setFleet] = useState<any[]>([]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'tracking_fleet'), (snapshot) => {
            const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFleet(drivers);
        });

        return () => unsubscribe();
    }, []);

    // Centro inicial: CDMX o la ciudad base
    const defaultCenter: [number, number] = [19.4326, -99.1332];

    return (
        <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid #1e293b' }}>
            <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                {/* Capa de OpenStreetMap (100% Gratuita, Sin API Keys) */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                />

                {fleet.map((driver) => (
                    driver.lat && driver.lng ? (
                        <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={driverIcon}>
                            <Popup>
                                <div style={{ textAlign: 'center' }}>
                                    <h4 style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{driver.driverName || 'Repartidor'}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                                        Velocidad: {driver.speed ? (driver.speed * 3.6).toFixed(1) : 0} km/h
                                    </p>
                                    <p style={{ margin: '5px 0 0', fontSize: '0.7rem', color: '#999' }}>
                                        Última act: {new Date(driver.lastUpdated).toLocaleTimeString()}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    ) : null
                ))}
            </MapContainer>
        </div>
    );
}
