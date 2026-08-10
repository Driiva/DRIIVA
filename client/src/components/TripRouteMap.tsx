/**
 * TripRouteMap — draws a driven GPS path as a Leaflet Polyline.
 *
 * Accepts an array of TripPoints (the same compressed format stored in
 * Firestore's tripPoints collection) and renders start/end markers plus the
 * route line, auto-fitting the map bounds to the trace.
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripPoint } from '../../../shared/firestore-types';

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface TripRouteMapProps {
  points: TripPoint[];
  className?: string;
  height?: string;
}

function FitBounds({ positions }: { positions: L.LatLngExpression[] }) {
  const map = useMap();

  useMemo(() => {
    if (positions.length < 2) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [positions, map]);

  return null;
}

export default function TripRouteMap({
  points,
  className,
  height = '350px',
}: TripRouteMapProps) {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.t - b.t),
    [points],
  );

  const positions: L.LatLngExpression[] = useMemo(
    () => sorted.map((p) => [p.lat, p.lng] as [number, number]),
    [sorted],
  );

  if (positions.length < 2) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1a1a2e]/50 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-white/60 text-sm">Not enough GPS points to draw a route</p>
      </div>
    );
  }

  const start = positions[0];
  const end = positions[positions.length - 1];
  const center = start;

  return (
    <div className={`rounded-xl overflow-hidden ${className ?? ''}`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds positions={positions} />

        <Polyline
          positions={positions}
          pathOptions={{ color: '#10b981', weight: 4, opacity: 0.85 }}
        />

        <Marker position={start} icon={startIcon}>
          <Popup><span className="text-sm font-bold text-gray-700">Start</span></Popup>
        </Marker>
        <Marker position={end} icon={endIcon}>
          <Popup><span className="text-sm font-bold text-gray-700">End</span></Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
