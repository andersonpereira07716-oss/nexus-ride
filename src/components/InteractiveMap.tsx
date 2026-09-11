import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix dos ícones padrões do Leaflet no React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícone do Carro (Motorista)
const driverIcon = new L.DivIcon({
  html: `<div style="background-color: #06b6d4; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #0f172a; box-shadow: 0 0 12px rgba(6,182,212,0.8); font-size: 16px;">🚘</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Ícone do Destino
const destinationIcon = new L.DivIcon({
  html: `<div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #0f172a; box-shadow: 0 0 12px rgba(16,185,129,0.8); font-size: 16px;">📍</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface InteractiveMapProps {
  originCoords?: [number, number] | null;
  destinationCoords?: [number, number] | null;
  destinationName?: string;
  routeCoordinates?: [number, number][];
}

function MapViewController({ origin, destination }: { origin?: [number, number] | null; destination?: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (origin && destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (destination) {
      map.setView(destination, 15);
    } else if (origin) {
      map.setView(origin, 15);
    }
  }, [origin, destination, map]);

  return null;
}

export function InteractiveMap({
  originCoords = [-7.0253, -37.2801], // Patos Centro por padrão
  destinationCoords,
  destinationName,
  routeCoordinates = []
}: InteractiveMapProps) {
  const defaultCenter: [number, number] = originCoords || [-7.0253, -37.2801];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={14}
      zoomControl={false}
      className="w-full h-full rounded-none"
    >
      {/* Servidor OpenStreetMap padrão 100% gratuito e sem API Key */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewController origin={originCoords} destination={destinationCoords} />

      {/* Marcador do Motorista/Origem */}
      {originCoords && (
        <Marker position={originCoords} icon={driverIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>
      )}

      {/* Marcador do Destino */}
      {destinationCoords && (
        <Marker position={destinationCoords} icon={destinationIcon}>
          <Popup>{destinationName || 'Destino'}</Popup>
        </Marker>
      )}

      {/* Linha da Rota no Mapa */}
      {routeCoordinates.length > 0 && (
        <>
          {/* Brilho da Rota */}
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: '#06b6d4', weight: 8, opacity: 0.4 }}
          />
          {/* Linha Central da Rota */}
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: '#0284c7', weight: 5, opacity: 0.9, dashArray: '8, 8' }}
          />
        </>
      )}
    </MapContainer>
  );
}
