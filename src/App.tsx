import React, { useState, useEffect } from 'react';
import { InteractiveMap } from './components/InteractiveMap';
import { Shield, Search, ChevronRight, MapPin, X, Car, Clock, CheckCircle2, User, Navigation, DollarSign, Bell, Check, Sparkles, Timer } from 'lucide-react';

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

const INITIAL_TIMER_SECONDS = 15;

// Coordenadas em Patos - PB
const MATERNIDADE_COORDS: [number, number] = [-7.0298, -37.2831];
const RODOVIARIA_COORDS: [number, number] = [-7.0185, -37.2722];

// Pontos intermediários para formar a curva da rota nas ruas de Patos
const SAMPLE_ROUTE_PATOS: [number, number][] = [
  MATERNIDADE_COORDS,
  [-7.0280, -37.2810],
  [-7.0253, -37.2801], // Centro
  [-7.0220, -37.2760],
  RODOVIARIA_COORDS
];

export default function App() {
  const [userRole, setUserRole] = useState<'passenger' | 'driver'>('passenger');
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<any | null>(null);
  const [driverActiveRide, setDriverActiveRide] = useState<boolean>(false);
  const [driverEarnings, setDriverEarnings] = useState<number>(142.50);
  const [driverRidesCount, setDriverRidesCount] = useState<number>(8);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  const [timeLeft, setTimeLeft] = useState<number>(INITIAL_TIMER_SECONDS);

  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(MATERNIDADE_COORDS);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [activeRoute, setActiveRoute] = useState<[number, number][]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Lite' | 'Comfort' | 'Black'>('Lite');
  
  const [rideStatus, setRideStatus] = useState<'idle' | 'selecting' | 'searching' | 'accepted'>('idle');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };

      playTone(880, 0, 0.15);
      playTone(1174.66, 0.18, 0.25);
    } catch (e) {
      console.error("Erro ao tocar áudio:", e);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (userRole === 'driver' && isDriverOnline && !incomingRide && !driverActiveRide) {
      timer = setTimeout(() => {
        setIncomingRide({
          passengerName: 'Maria Eduarda',
          pickup: 'Maternidade Peregrino Filho',
          dropoff: 'Rodoviária de Patos',
          distance: '3.8 km',
          fare: 14.20,
          category: 'Nexus Lite',
          pickupCoords: MATERNIDADE_COORDS,
          coords: RODOVIARIA_COORDS
        });
        setTimeLeft(INITIAL_TIMER_SECONDS);
        playNotificationSound();
      }, 3500);
    }
    return () => clearTimeout(timer);
  }, [userRole, isDriverOnline, incomingRide, driverActiveRide]);

  useEffect(() => {
    if (!incomingRide) return;

    if (timeLeft <= 0) {
      setIncomingRide(null);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingRide, timeLeft]);

  const calculatePrice = (lat2: number, lon2: number) => {
    const lat1 = MATERNIDADE_COORDS[0];
    const lon1 = MATERNIDADE_COORDS[1];
    
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

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
    setActiveRoute([MATERNIDADE_COORDS, [lat, lon]]);
  };

  const handleClear = () => {
    setDestination('');
    setSuggestions([]);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setRideStatus('idle');
  };

  const handleRequestRide = () => {
    setRideStatus('searching');
    setTimeout(() => {
      setRideStatus('accepted');
    }, 4000);
  };

  const handleAcceptRide = () => {
    if (incomingRide) {
      setOriginCoords(incomingRide.pickupCoords);
      setSelectedCoords(incomingRide.coords);
      setSelectedName(incomingRide.dropoff);
      setActiveRoute(SAMPLE_ROUTE_PATOS);
    }
    setIncomingRide(null);
    setDriverActiveRide(true);
  };

  const handleFinishDriverRide = () => {
    setDriverActiveRide(false);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setDriverEarnings(prev => prev + 14.20);
    setDriverRidesCount(prev => prev + 1);
    
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 4000);
  };

  const handleRejectRide = () => {
    setIncomingRide(null);
  };

  const timerProgress = (timeLeft / INITIAL_TIMER_SECONDS) * 100;

  return (
    <div className="relative h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col">
      {/* TOAST DE SUCESSO */}
      {showSuccessToast && (
        <div className="absolute top-16 inset-x-4 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-emerald-400/50 animate-bounce-short">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950/30 flex items-center justify-center text-emerald-200 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Corrida Finalizada!</p>
              <p className="text-[11px] font-medium text-emerald-100">+ R$ 14,20 adicionados aos seus ganhos</p>
            </div>
          </div>
          <button onClick={() => setShowSuccessToast(false)} className="p-1 text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER TOP BAR */}
      <header className="relative z-10 p-3 flex justify-between items-center backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[2px]">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250" 
              alt="Avatar" 
              className="w-full h-full rounded-full object-cover" 
            />
          </div>
          <div>
            <h1 className="text-[10px] uppercase font-semibold text-cyan-400 tracking-wider">
              {userRole === 'passenger' ? 'Passageiro' : 'Motorista Parceiro'}
            </h1>
            <p className="text-sm font-bold tracking-wide text-slate-100">Anderson Silva 👋</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const nextRole = userRole === 'passenger' ? 'driver' : 'passenger';
              setUserRole(nextRole);
              handleClear();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              userRole === 'driver'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {userRole === 'passenger' ? <Car className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{userRole === 'passenger' ? 'Modo Motorista' : 'Modo Passageiro'}</span>
          </button>
        </div>
      </header>

      {/* MAPA INTERATIVO COM ROTA */}
      <div className="flex-1 relative z-0">
        <InteractiveMap 
          originCoords={originCoords}
          destinationCoords={selectedCoords} 
          destinationName={selectedName} 
          routeCoordinates={activeRoute}
        />
      </div>

      {/* POPUP DE NOVA CORRIDA */}
      {userRole === 'driver' && incomingRide && (
        <div className="absolute inset-x-4 top-20 z-50 bg-slate-900/95 border-2 border-cyan-500 rounded-3xl p-4 shadow-2xl backdrop-blur-xl overflow-hidden animate-bounce-short">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-1000 ease-linear"
              style={{ width: `${timerProgress}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center mb-3 pt-1">
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/40">
              <Bell className="w-3.5 h-3.5 animate-pulse" /> NOVA CORRIDA DISPONÍVEL
            </span>
            <span className="flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
              <Timer className="w-3.5 h-3.5" /> {timeLeft}s
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm font-bold text-slate-100">{incomingRide.passengerName}</p>
            <div className="text-xs space-y-1 text-slate-300">
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <strong>Origem:</strong> {incomingRide.pickup}</p>
              <p className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> <strong>Destino:</strong> {incomingRide.dropoff}</p>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">Distância: {incomingRide.distance}</span>
              <span className="text-lg font-black text-emerald-400">R$ {incomingRide.fare.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleRejectRide}
              className="py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-2xl text-xs"
            >
              Recusar
            </button>
            <button 
              onClick={handleAcceptRide}
              className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/20"
            >
              ACEITAR CORRIDA
            </button>
          </div>
        </div>
      )}

      {/* PAINEL PASSAGEIRO */}
      {userRole === 'passenger' && (
        <div className="relative z-20 p-4 pb-8 space-y-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 rounded-t-3xl shadow-2xl">
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
                  <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 bg-slate-800/80 rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                )}

                {suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-56 overflow-y-auto">
                    {suggestions.map((item) => (
                      <button
                        key={item.place_id}
                        onClick={() => handleSelectPlace(item)}
                        className="w-full p-3 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-none flex items-start gap-3"
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
                    className="flex flex-col items-start p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 text-left hover:border-cyan-500/50"
                  >
                    <span className="text-base mb-1">{item.icon}</span>
                    <span className="text-xs font-bold text-slate-200">{item.label}</span>
                    <span className="text-[10px] text-slate-400 truncate w-full">{item.addr}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {rideStatus === 'selecting' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Destino Confirmado</span>
                  <h3 className="text-sm font-bold text-slate-100 truncate">{selectedName}</h3>
                </div>
                <button onClick={handleClear} className="p-1 text-slate-400">
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
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between ${
                        isSelected ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500' : 'bg-slate-950/40 border-slate-800'
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
                className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2"
              >
                <span>CONFIRMAR {selectedCategory.toUpperCase()}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {rideStatus === 'searching' && (
            <div className="py-6 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <Car className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Procurando motoristas próximos...</h3>
                <p className="text-xs text-slate-400 mt-1">Conectando você ao melhor condutor em Patos</p>
              </div>
              <button onClick={() => setRideStatus('selecting')} className="px-4 py-2 bg-slate-800 text-xs font-semibold rounded-xl text-slate-300 border border-slate-700">
                Cancelar Solicitação
              </button>
            </div>
          )}

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

              <button onClick={handleClear} className="w-full py-3 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs border border-slate-700">
                Concluir / Nova Corrida
              </button>
            </div>
          )}
        </div>
      )}

      {/* PAINEL MOTORISTA */}
      {userRole === 'driver' && (
        <div className="relative z-20 p-4 pb-8 space-y-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 rounded-t-3xl shadow-2xl">
          <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isDriverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
              <div>
                <p className="text-xs font-bold text-slate-200">{isDriverOnline ? 'Você está Online' : 'Você está Offline'}</p>
                <p className="text-[10px] text-slate-400">{isDriverOnline ? 'Aguardando chamadas em Patos...' : 'Toque para iniciar o turno'}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsDriverOnline(!isDriverOnline);
                if (isDriverOnline) {
                  setIncomingRide(null);
                  setDriverActiveRide(false);
                  setSelectedCoords(null);
                  setSelectedName('');
                  setActiveRoute([]);
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                isDriverOnline
                  ? 'bg-rose-500/20 border border-rose-500 text-rose-300'
                  : 'bg-emerald-500 text-slate-950 font-extrabold'
              }`}
            >
              {isDriverOnline ? 'FICAR OFFLINE' : 'FICAR ONLINE'}
            </button>
          </div>

          {driverActiveRide ? (
            <div className="bg-emerald-950/30 border border-emerald-500/50 p-3 rounded-2xl space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 animate-pulse" /> CORRIDA EM ANDAMENTO
                </span>
                <span className="text-sm font-black text-emerald-400">R$ 14,20</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                <p className="text-xs font-bold text-slate-100">Passageira: Maria Eduarda</p>
                <p className="text-[11px] text-slate-300 mt-0.5">📍 Ir para: Rodoviária de Patos</p>
              </div>
              <button 
                onClick={handleFinishDriverRide}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> FINALIZAR CORRIDA E RECEBER
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80 flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="text-[10px] text-slate-400">Ganhos de Hoje</p>
                  <p className="text-sm font-extrabold text-slate-100">R$ {driverEarnings.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80 flex items-center gap-3">
                <Navigation className="w-6 h-6 text-cyan-400" />
                <div>
                  <p className="text-[10px] text-slate-400">Corridas Efetuadas</p>
                  <p className="text-sm font-extrabold text-slate-100">{driverRidesCount} corridas</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
