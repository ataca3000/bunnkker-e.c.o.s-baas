import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, useMap } from 'react-leaflet';
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

export interface DeliveryZoneMapConfig {
  enabled?: boolean;
  center: [number, number];
  radiusKm: number;
  address?: string;
}

interface AdvancedRouteMapProps {
  mode: 'picker' | 'route' | 'zone';
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
  // Delivery Zone / Geofence Props
  deliveryZone?: DeliveryZoneMapConfig;
  onZoneCenterChange?: (pos: [number, number]) => void;
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

function ZoneClickPicker({ onSelect }: { onSelect?: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            if (onSelect) onSelect([e.latlng.lat, e.latlng.lng]);
        }
    });
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
    useOfflineTiles = false,
    deliveryZone,
    onZoneCenterChange
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

    const zoneCenter = deliveryZone?.center || warehouseLocation;
    const zoneRadiusMeters = (deliveryZone?.radiusKm || 10) * 1000;

    return (
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', borderRadius: '0.5rem', zIndex: 1 }}>
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url={tileUrl}
            />
            
            {/* ── CÍRCULO DE COBERTURA / GEOFENCE COMPARTIDO (VISIBLE PARA TODOS) ── */}
            {deliveryZone && deliveryZone.enabled !== false && (
                <Circle 
                    center={zoneCenter} 
                    radius={zoneRadiusMeters} 
                    pathOptions={{ 
                        color: '#06b6d4', 
                        fillColor: '#06b6d4', 
                        fillOpacity: 0.14,
                        weight: 2,
                        dashArray: mode === 'zone' ? '6, 6' : undefined
                    }} 
                />
            )}

            {/* ── MODO 1: PICKER (Ubicación de Cliente) ── */}
            {mode === 'picker' && (
                <LocationPicker 
                    position={pickerPos} 
                    setPosition={setPickerPos} 
                    onSelect={onLocationSelect} 
                />
            )}

            {/* ── MODO 2: ZONA / COBERTURA (Configuración SuperAdmin) ── */}
            {mode === 'zone' && (
                <>
                    <ZoneClickPicker onSelect={onZoneCenterChange} />
                    <Marker 
                        position={zoneCenter}
                        draggable={true}
                        eventHandlers={{
                            dragend: (e) => {
                                const pos = e.target.getLatLng();
                                if (onZoneCenterChange) onZoneCenterChange([pos.lat, pos.lng]);
                            }
                        }}
                    >
                        <Popup>
                            <div className="font-black text-slate-900 text-xs">📍 Matriz / Almacén Central</div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                                Arrastra este pin o haz clic en el mapa para ubicar tu negocio.
                            </div>
                            <div className="text-[10px] text-cyan-600 font-bold mt-1">
                                Cobertura activa: {deliveryZone?.radiusKm || 10} km
                            </div>
                        </Popup>
                    </Marker>
                </>
            )}

            {/* ── MODO 3: RUTA (Repartidor / Despacho) ── */}
            {mode === 'route' && (
                <>
                    <MapBoundsFitter markers={markers} warehouseLocation={warehouseLocation} />
                    
                    {/* Marcador de Bodega */}
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
