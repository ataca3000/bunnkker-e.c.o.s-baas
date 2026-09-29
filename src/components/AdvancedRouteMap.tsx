import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix para iconos en Next.js
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

export interface RouteMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  isDelivered?: boolean;
}

interface AdvancedRouteMapProps {
  mode: 'picker' | 'route';
  center?: [number, number];
  zoom?: number;
  // Picker Props
  onLocationSelect?: (lat: number, lng: number) => void;
  initialPickerPosition?: [number, number];
  // Route Props
  markers?: RouteMarker[];
  routeIndices?: number[]; // [0, 2, 1] means route goes from Warehouse -> marker 0 -> marker 2 -> marker 1 -> Warehouse
  warehouseLocation?: [number, number];
  onMarkerClick?: (marker: RouteMarker) => void;
  useOfflineTiles?: boolean;
}

function LocationPicker({ position, setPosition, onSelect }: any) {
    const map = useMapEvents({
      click(e) {
        setPosition(e.latlng);
        if (onSelect) onSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    
    useEffect(() => {
        if (position) map.flyTo(position, map.getZoom());
    }, [position, map]);
  
    return position === null ? null : (
      <Marker 
        position={position} 
        draggable={true}
        eventHandlers={{
            dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                setPosition(pos);
                if (onSelect) onSelect(pos.lat, pos.lng);
            },
        }}
      >
          <Popup>Tu ubicación de entrega</Popup>
      </Marker>
    );
}

function MapBoundsFitter({ markers, warehouseLocation }: { markers?: RouteMarker[], warehouseLocation?: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        if (!markers || markers.length === 0) return;
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
        if (warehouseLocation) bounds.extend(warehouseLocation);
        map.fitBounds(bounds, { padding: [50, 50] });
    }, [markers, warehouseLocation, map]);
    return null;
}

export default function AdvancedRouteMap({ 
    mode, 
    center = [19.4326, -99.1332], 
    zoom = 13,
    onLocationSelect,
    initialPickerPosition,
    markers = [],
    routeIndices = [],
    warehouseLocation = [19.4326, -99.1332],
    onMarkerClick,
    useOfflineTiles = false
}: AdvancedRouteMapProps) {
    const [pickerPos, setPickerPos] = useState<L.LatLng | null>(initialPickerPosition ? new L.LatLng(initialPickerPosition[0], initialPickerPosition[1]) : null);

    // URL para tiles offline servidos desde la carpeta public o API local
    // Si no está offline, usa OSM público.
    const tileUrl = useOfflineTiles 
        ? "/tiles/{z}/{x}/{y}.png" 
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    // Calcular la polyline de la ruta
    const routeCoords: [number, number][] = [];
    if (mode === 'route' && markers.length > 0) {
        routeCoords.push(warehouseLocation); // Inicio en bodega
        if (routeIndices.length === markers.length) {
            // Seguir orden optimizado (TSP)
            routeIndices.forEach(idx => {
                const m = markers[idx];
                if (m) routeCoords.push([m.lat, m.lng]);
            });
        } else {
            // Orden normal
            markers.forEach(m => routeCoords.push([m.lat, m.lng]));
        }
        routeCoords.push(warehouseLocation); // Regreso a bodega
    }

    return (
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '0.5rem', zIndex: 1 }}>
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url={tileUrl}
            />
            
            {mode === 'picker' && (
                <LocationPicker 
                    position={pickerPos} 
                    setPosition={setPickerPos} 
                    onSelect={onLocationSelect} 
                />
            )}

            {mode === 'route' && (
                <>
                    <MapBoundsFitter markers={markers} warehouseLocation={warehouseLocation} />
                    
                    {/* Marcador de Bodega (se usa el mismo default pero con color/texto distinto en Popup) */}
                    <Marker position={warehouseLocation}>
                        <Popup>Bodega Principal (Inicio/Fin)</Popup>
                    </Marker>

                    {/* Ruta trazada */}
                    {routeCoords.length > 2 && (
                        <Polyline positions={routeCoords} color="#0ea5e9" weight={4} opacity={0.7} dashArray="10, 10" />
                    )}

                    {/* Marcadores de Entregas */}
                    {markers.map((marker, i) => (
                        <Marker 
                            key={marker.id} 
                            position={[marker.lat, marker.lng]}
                            eventHandlers={{
                                click: () => { if (onMarkerClick) onMarkerClick(marker); }
                            }}
                            opacity={marker.isDelivered ? 0.5 : 1}
                        >
                            <Popup>
                                <div style={{ fontWeight: 'bold' }}>{marker.title}</div>
                                {marker.description && <div style={{ fontSize: '0.85rem' }}>{marker.description}</div>}
                                <div style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 'bold', marginTop: '4px' }}>
                                    Orden de entrega: {routeIndices.indexOf(i) !== -1 ? routeIndices.indexOf(i) + 1 : i + 1}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </>
            )}
        </MapContainer>
    );
}
