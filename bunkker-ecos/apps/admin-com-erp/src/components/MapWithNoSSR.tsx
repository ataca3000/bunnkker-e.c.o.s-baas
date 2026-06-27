import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

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

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
}

interface MapProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
}

export default function MapWithNoSSR({ markers, center = [19.4326, -99.1332], zoom = 12 }: MapProps) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '1rem', zIndex: 10 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]}>
          <Popup>
            <div style={{ fontWeight: 'bold' }}>{marker.title}</div>
            {marker.description && <div style={{ fontSize: '0.85rem', color: '#666' }}>{marker.description}</div>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
