import React, { useState, useEffect } from 'react';
import { InteractiveMap } from './components/InteractiveMap';
import { Shield, Search, ChevronRight, MapPin, X, Car, Clock, CheckCircle2 } from 'lucide-react';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface VehicleOption {
  id: 'Lite' | 'Comfort' | 'Black';
  name: string;
  multiplier: number;
  time: string;
  icon: string;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: 'Lite', name: 'Nexus Lite', multiplier: 1.0, time: '3 min', icon: '⚡' },
  { id: 'Comfort', name: 'Nexus Comfort', multiplier: 1.35, time: '5 min', icon: '🚘' },
  { id: 'Black', name: 'Nexus Black', multiplier: 1.8, time: '7 min', icon: '🕶️' },
];

export default function App() {
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Lite' | 'Comfort' | 'Black'>('Lite');
  
  // Estados da Corrida
  const [rideStatus, setRideStatus] = useState<'idle' | 'selecting' | 'searching' | 'accepted'>('idle');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);

  // Calcula distância simples e define preço base
  const calculatePrice = (lat2: number, lon2: number) => {
    // Coordenada base inicial (Patos)
    const lat1 = -7.0253;
    const lon1 = -37.2801;
    
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Tarifa Base: R$ 5,00 + R$ 2,20 por km
    const basePrice = 5.0 + Math.max(distanceKm, 1.5) * 2.2;
    setEstimatedPrice(basePrice);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (destination.trim().length > 2 && !selectedName && rideStatus === 'idle') {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              destination + ', Patos, PB'
            )}&limit=5&addressdetails=1`
          );
          const data = await response.json();
          setSuggestions(data);
        } catch (error) {
          console.error("Erro ao buscar endereços:", error);
        }
      } else {
        setSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [destination, selectedName, rideStatus]);

  const handleSelectPlace = (place: SearchResult) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    const shortName = place.display_name.split(',')[0];
    
    setSelectedCoords([lat, lon]);
    setSelectedName(shortName);
    setDestination(shortName);
    setSuggestions([]);
    calculatePrice(lat, lon);
    setRideStatus('selecting');
  };

  const handleClear = () => {
    setDestination('');
    setSuggestions([]);
    setSelectedCoords(null);
    setSelectedName('');
    setRideStatus('idle');
  };

  const handleRequestRide = () => {
    setRideStatus('searching');
    // Simula tempo de busca de motorista em tempo real
    setTimeout(() => {
      setRideStatus('accepted');
    }, 4000);
  };

  return (
    <div className="relative h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col">
      {/* HEADER TOP BAR */}
      <header className="relative z-10 p-4 flex justify-between items-center backdrop-blur-md bg-slate-900/60 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[2px]">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250" 
              alt="Avatar" 
              className="w-full h-full rounded-full object-cover" 
            />
          </div>
          <div>
            <h1 className="text-xs text-slate-400">Bem-vindo de volta</h1>
            <p className="text-sm font-bold tracking-wide text-slate-100">Anderson Silva 👋</p>
          </div>
        </div>
        <button className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 relative">
          <Shield className="w-5 h-5 text-cyan-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-slate-900"></span>
        </button>
      </header>

      {/* MAPA INTERATIVO REAL */}
      <div className="flex-1 relative z-0">
        <InteractiveMap 
          destinationCoords={selectedCoords} 
          destinationName={selectedName} 
        />
      </div>

      {/* PAINEL DE AÇÕES / FLUXO DE CORRIDA */}
      <div className="relative z-20 p-4 space-y-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 rounded-t-3xl shadow-2xl transition-all">
        
        {/* MODO 1: BUSCANDO ENDEREÇO */}
        {rideStatus === 'idle' && (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
              <input 
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (selectedName) setSelectedName('');
                }}
                placeholder="Para onde vamos hoje?"
                className="w-full pl-12 pr-10 py-4 bg-slate-950/80 border border-slate-700/60 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium text-sm"
              />
              {destination && (
                <button 
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-56 overflow-y-auto">
                  {suggestions.map((item) => (
                    <button
                      key={item.place_id}
                      onClick={() => handleSelectPlace(item)}
                      className="w-full p-3 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-none flex items-start gap-3 transition-colors"
                    >
                      <MapPin className="w-4 h-4 text-cyan-400 mt-1 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-100 truncate">{item.display_name.split(',')[0]}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.display_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Shopping', icon: '🛍️', addr: 'Centro' },
                { label: 'UFCG Patos', icon: '🎓', addr: 'Jardim Guanabara' },
                { label: 'Rodoviária', icon: '🚌', addr: 'Belo Horizonte' },
              ].map((item, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setDestination(item.label)}
                  className="flex flex-col items-start p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 text-left hover:border-cyan-500/50 transition-colors"
                >
                  <span className="text-base mb-1">{item.icon}</span>
                  <span className="text-xs font-bold text-slate-200">{item.label}</span>
                  <span className="text-[10px] text-slate-400 truncate w-full">{item.addr}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* MODO 2: SELEÇÃO DE CATEGORIA E PREÇO */}
        {rideStatus === 'selecting' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Destino Confirmado</span>
                <h3 className="text-sm font-bold text-slate-100 truncate">{selectedName}</h3>
              </div>
              <button onClick={handleClear} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {VEHICLE_OPTIONS.map((v) => {
                const finalPrice = (estimatedPrice * v.multiplier).toFixed(2);
                const isSelected = selectedCategory === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedCategory(v.id)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{v.icon}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-100">{v.name}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" /> {v.time} de chegada
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-cyan-400">R$ {finalPrice}</p>
                      <p className="text-[9px] text-slate-500">Pix / Cartão</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button 
              onClick={handleRequestRide}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-white shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            >
              <span>CONFIRMAR {selectedCategory.toUpperCase()}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* MODO 3: PROCURANDO MOTORISTA */}
        {rideStatus === 'searching' && (
          <div className="py-6 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
              <Car className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Procurando motoristas próximos...</h3>
              <p className="text-xs text-slate-400 mt-1">Conectando você ao melhor condutor no Nexus Ride Patos</p>
            </div>
            <button 
              onClick={() => setRideStatus('selecting')}
              className="px-4 py-2 bg-slate-800 text-xs font-semibold rounded-xl text-slate-300 border border-slate-700"
            >
              Cancelar Solicitação
            </button>
          </div>
        )}

        {/* MODO 4: MOTORISTA ENCONTRADO */}
        {rideStatus === 'accepted' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-300">Motorista a caminho!</p>
                <p className="text-[10px] text-slate-300">Chegada estimada em 4 minutos</p>
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-900/40 border border-cyan-500/30 rounded-full flex items-center justify-center font-bold text-cyan-400">
                  MR
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-100">Marcos Roberto</p>
                  <p className="text-[10px] text-slate-400">Toyota Corolla • ABC-4K12</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-cyan-400">⭐ 4.98</p>
                <p className="text-[9px] text-slate-500">1.240 corridas</p>
              </div>
            </div>

            <button 
              onClick={handleClear}
              className="w-full py-3 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs border border-slate-700"
            >
              Concluir / Nova Corrida
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
