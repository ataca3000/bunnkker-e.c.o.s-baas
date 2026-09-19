"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect } from 'react';

// Solución para iconos perdidos de Leaflet en Next.js
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialCenter?: [number, number];
}

function LocationMarker({ onLocationSelect, initialCenter }: { onLocationSelect: (lat: number, lng: number) => void, initialCenter: [number, number] }) {
  const [position, setPosition] = useState<L.LatLng | null>(L.latLng(initialCenter[0], initialCenter[1]));

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function LocationPickerMap({ onLocationSelect, initialCenter = [19.4326, -99.1332] }: LocationPickerMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <MapContainer center={initialCenter} zoom={13} style={{ height: '200px', width: '100%', borderRadius: '8px', zIndex: 10, marginTop: '10px' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker onLocationSelect={onLocationSelect} initialCenter={initialCenter} />
    </MapContainer>
  );
}
