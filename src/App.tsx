import { useState, useEffect } from 'react';
import { InteractiveMap } from './components/InteractiveMap';
import { Auth } from './components/Auth';
import { RideHistory } from './components/RideHistory';
import { RatingModal } from './components/RatingModal';
import { EditProfile } from './components/EditProfile';
import { History } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Search, ChevronRight, MapPin, X, Car, Clock, User, Navigation, Bell, Sparkles, Timer } from 'lucide-react';

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
const FALLBACK_COORDS: [number, number] = [-7.0298, -37.2831];

interface IncomingRide {
  id: string;
  passengerName: string;
  pickup: string;
  dropoff: string;
  distance: string;
  fare: number;
  category: string;
  pickupCoords: [number, number];
  coords: [number, number];
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null; phone: string | null } | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ rideId: string; rateeId: string; rateeName: string } | null>(null);

  const [userRole, setUserRole] = useState<'passenger' | 'driver'>('passenger');
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<IncomingRide | null>(null);
  const [driverActiveRide, setDriverActiveRide] = useState<boolean>(false);
  const [driverEarnings, setDriverEarnings] = useState<number>(0);
  const [driverRidesCount, setDriverRidesCount] = useState<number>(0);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [lastFareEarned, setLastFareEarned] = useState<number>(0);

  const [timeLeft, setTimeLeft] = useState<number>(INITIAL_TIMER_SECONDS);

  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [activeRoute, setActiveRoute] = useState<[number, number][]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Lite' | 'Comfort' | 'Black'>('Lite');

  const [rideStatus, setRideStatus] = useState<'idle' | 'selecting' | 'searching' | 'accepted'>('idle');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [rideId, setRideId] = useState<string | null>(null);

  // ---- AUTENTICAÇÃO ----
  useEffect(() => {
    const safetyTimeout = setTimeout(() => setAuthLoading(false), 4000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimeout);
      setSession(session);
      setAuthLoading(false);
    }).catch(() => {
      clearTimeout(safetyTimeout);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('full_name, avatar_url, phone, driver_earnings, driver_rides_count')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setDriverEarnings(Number(data.driver_earnings) || 0);
          setDriverRidesCount(Number(data.driver_rides_count) || 0);
        }
      });
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // ---- GEOLOCALIZAÇÃO REAL ----
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada neste navegador.');
      setOriginCoords(FALLBACK_COORDS);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setOriginCoords([position.coords.latitude, position.coords.longitude]);
        setLocationError(null);
      },
      () => {
        setLocationError('Não foi possível obter sua localização. Ative o GPS e permita o acesso.');
        setOriginCoords(FALLBACK_COORDS);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ---- MOTORISTA: escuta corridas reais + publica status online ----
  useEffect(() => {
    if (userRole !== 'driver' || !isDriverOnline || driverActiveRide) return;

    const channel = supabase
      .channel('driver-new-rides')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.searching' },
        async (payload) => {
          const ride = payload.new as any;
          const { data: passengerProfile } = await supabase
            .from('public_profiles')
            .select('full_name')
            .eq('id', ride.passenger_id)
            .single();

          setIncomingRide({
            id: ride.id,
            passengerName: passengerProfile?.full_name || 'Passageiro',
            pickup: ride.pickup_name || 'Local de partida',
            dropoff: ride.dropoff_name || 'Destino',
            distance: ride.distance_km ? `${Number(ride.distance_km).toFixed(1)} km` : '—',
            fare: Number(ride.fare),
            category: ride.category,
            pickupCoords: [ride.pickup_lat, ride.pickup_lng],
            coords: [ride.dropoff_lat, ride.dropoff_lng],
          });
          setTimeLeft(INITIAL_TIMER_SECONDS);
          playNotificationSound();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userRole, isDriverOnline, driverActiveRide]);

  useEffect(() => {
    if (!session?.user || userRole !== 'driver') return;
    supabase.from('driver_status').upsert({
      driver_id: session.user.id,
      is_online: isDriverOnline,
      lat: originCoords ? originCoords[0] : null,
      lng: originCoords ? originCoords[1] : null,
      updated_at: new Date().toISOString(),
    }).then();
  }, [session, userRole, isDriverOnline, originCoords]);

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
      console.error('Erro ao tocar áudio:', e);
    }
  };

  useEffect(() => {
    if (!incomingRide) return;
    if (timeLeft <= 0) {
      setIncomingRide(null);
      return;
    }
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [incomingRide, timeLeft]);

  const calculatePrice = (lat2: number, lon2: number) => {
    const origin = originCoords || FALLBACK_COORDS;
    const [lat1, lon1] = origin;
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
    return distanceKm;
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (destination.trim().length > 2 && !selectedName && rideStatus === 'idle') {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination + ', Patos, PB')}&limit=5&addressdetails=1`
          );
          const data = await response.json();
          setSuggestions(data);
        } catch (error) {
          console.error('Erro ao buscar endereços:', error);
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
    setActiveRoute(originCoords ? [originCoords, [lat, lon]] : [[lat, lon]]);
  };

  const handleClear = async () => {
    if (rideId) {
      await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', rideId)
        .in('status', ['searching', 'accepted']);
    }
    setDestination('');
    setSuggestions([]);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setRideStatus('idle');
    setRideId(null);
  };

  const handleRequestRide = async () => {
    if (!session?.user || !originCoords || !selectedCoords) return;
    setRideStatus('searching');

    const distanceKm = calculatePrice(selectedCoords[0], selectedCoords[1]);
    const finalFare = estimatedPrice * VEHICLE_OPTIONS.find(v => v.id === selectedCategory)!.multiplier;

    const { data, error } = await supabase
      .from('rides')
      .insert({
        passenger_id: session.user.id,
        status: 'searching',
        pickup_lat: originCoords[0], pickup_lng: originCoords[1], pickup_name: 'Sua localização',
        dropoff_lat: selectedCoords[0], dropoff_lng: selectedCoords[1], dropoff_name: selectedName,
        category: selectedCategory, fare: finalFare, distance_km: distanceKm,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao criar corrida:', error);
      setRideStatus('selecting');
      return;
    }

    setRideId(data.id);

    const channel = supabase
      .channel(`ride-${data.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${data.id}` },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'accepted') setRideStatus('accepted');
          if (updated.status === 'completed' && updated.driver_id) {
            const { data: driverProfile } = await supabase
              .from('public_profiles')
              .select('full_name')
              .eq('id', updated.driver_id)
              .single();
            setRatingTarget({ rideId: updated.id, rateeId: updated.driver_id, rateeName: driverProfile?.full_name || 'motorista' });
            setRideStatus('idle');
            setRideId(null);
          }
        }
      )
      .subscribe();

    setTimeout(() => supabase.removeChannel(channel), 5 * 60 * 1000);
  };

  const handleAcceptRide = async () => {
    if (!incomingRide || !session?.user) return;
    const { data, error } = await supabase
      .from('rides')
      .update({ driver_id: session.user.id, status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', incomingRide.id)
      .eq('status', 'searching')
      .select()
      .single();

    if (error || !data) {
      console.error('Corrida já foi aceita por outro motorista.');
      setIncomingRide(null);
      return;
    }

    setRideId(data.id);
    setSelectedCoords(incomingRide.coords);
    setSelectedName(incomingRide.dropoff);
    setActiveRoute(originCoords ? [originCoords, incomingRide.pickupCoords, incomingRide.coords] : [incomingRide.pickupCoords, incomingRide.coords]);
    setIncomingRide(null);
    setDriverActiveRide(true);
  };

  const handleFinishDriverRide = async () => {
    if (!rideId || !session?.user) return;
    const { data: rideData } = await supabase
      .from('rides')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', rideId)
      .select()
      .single();

    const fareEarned = rideData ? Number(rideData.fare) : 0;
    const newEarnings = driverEarnings + fareEarned;
    const newRidesCount = driverRidesCount + 1;

    await supabase
      .from('profiles')
      .update({ driver_earnings: newEarnings, driver_rides_count: newRidesCount })
      .eq('id', session.user.id);

    setDriverActiveRide(false);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setDriverEarnings(newEarnings);
    setDriverRidesCount(newRidesCount);
    setLastFareEarned(fareEarned);

    if (rideData?.passenger_id) {
      const { data: passengerProfile } = await supabase
        .from('public_profiles')
        .select('full_name')
        .eq('id', rideData.passenger_id)
        .single();
      setRatingTarget({ rideId, rateeId: rideData.passenger_id, rateeName: passengerProfile?.full_name || 'passageiro' });
    }
    setRideId(null);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
  };

  const handleRejectRide = () => setIncomingRide(null);

  const timerProgress = (timeLeft / INITIAL_TIMER_SECONDS) * 100;

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="Nexus Ride" className="w-20 h-20 rounded-2xl shadow-lg shadow-cyan-500/20" />
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="relative h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col">
      {showHistory && session && <RideHistory session={session} onClose={() => setShowHistory(false)} />}
      {showEditProfile && session && (
        <EditProfile
          session={session}
          currentName={profile?.full_name || ''}
          currentPhone={profile?.phone || null}
          currentAvatar={profile?.avatar_url || null}
          onClose={() => setShowEditProfile(false)}
          onSaved={(name, avatarUrl) => setProfile(prev => prev ? { ...prev, full_name: name, avatar_url: avatarUrl } : prev)}
        />
      )}
      {ratingTarget && session && (
        <RatingModal
          rideId={ratingTarget.rideId}
          raterId={session.user.id}
          rateeId={ratingTarget.rateeId}
          rateeName={ratingTarget.rateeName}
          onClose={() => setRatingTarget(null)}
        />
      )}
      {showSuccessToast && (
        <div className="absolute top-16 inset-x-4 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-emerald-400/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950/30 flex items-center justify-center text-emerald-200 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Corrida Finalizada!</p>
              <p className="text-[11px] font-medium text-emerald-100">+ R$ {lastFareEarned.toFixed(2)} adicionados aos seus ganhos</p>
            </div>
          </div>
          <button onClick={() => setShowSuccessToast(false)} className="p-1 text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {locationError && (
        <div className="absolute top-16 inset-x-4 z-40 bg-amber-600/90 text-white text-xs font-semibold p-2.5 rounded-xl text-center shadow-lg">
          {locationError}
        </div>
      )}

      <header className="relative z-10 p-3 flex justify-between items-center backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowEditProfile(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[2px] shrink-0"
          >
            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-cyan-300" />
              )}
            </div>
          </button>
          <div className="min-w-0">
            <h1 className="text-[10px] uppercase font-semibold text-cyan-400 tracking-wider">
              {userRole === 'passenger' ? 'Passageiro' : 'Motorista Parceiro'}
            </h1>
            <p className="text-sm font-bold tracking-wide text-slate-100 truncate">
              {profile?.full_name || session.user.email} 👋
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const nextRole = userRole === 'passenger' ? 'driver' : 'passenger';
              setUserRole(nextRole);
              handleClear();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              userRole === 'driver'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {userRole === 'passenger' ? <Car className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{userRole === 'passenger' ? 'Motorista' : 'Passageiro'}</span>
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={handleSignOut}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 relative z-0">
        <InteractiveMap
          originCoords={originCoords}
          destinationCoords={selectedCoords}
          destinationName={selectedName}
          routeCoordinates={activeRoute}
        />
      </div>

      {userRole === 'driver' && incomingRide && (
        <div className="absolute inset-x-4 top-20 z-50 bg-slate-900/95 border-2 border-cyan-500 rounded-3xl p-4 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-1000 ease-linear" style={{ width: `${timerProgress}%` }}></div>
          </div>
          <div className="flex justify-between items-center mb-3 pt-1">
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/40">
              <Bell className="w-3.5 h-3.5 animate-pulse" /> NOVA CORRIDA
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
            <button onClick={handleRejectRide} className="py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-2xl text-xs">Recusar</button>
            <button onClick={handleAcceptRide} className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/20">ACEITAR</button>
          </div>
        </div>
      )}

      {userRole === 'passenger' && (
        <div className="relative z-20 p-4 pb-8 space-y-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 rounded-t-3xl shadow-2xl">
          {rideStatus === 'idle' && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
              <input
                type="text"
                value={destination}
                onChange={(e) => { setDestination(e.target.value); if (selectedName) setSelectedName(''); }}
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
                    <button key={item.place_id} onClick={() => handleSelectPlace(item)} className="w-full p-3 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-none flex items-start gap-3">
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
          )}

          {rideStatus === 'selecting' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Destino Confirmado</span>
                  <h3 className="text-sm font-bold text-slate-100 truncate">{selectedName}</h3>
                </div>
                <button onClick={handleClear} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                {VEHICLE_OPTIONS.map((v) => {
                  const finalPrice = (estimatedPrice * v.multiplier).toFixed(2);
                  const isSelected = selectedCategory === v.id;
                  return (
                    <button key={v.id} onClick={() => setSelectedCategory(v.id)}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between ${isSelected ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500' : 'bg-slate-950/40 border-slate-800'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{v.icon}</span>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-100">{v.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400" /> {v.time} de chegada</p>
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
              <button onClick={handleRequestRide} className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2">
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
                <p className="text-xs text-slate-400 mt-1">Sua corrida foi publicada de verdade — aguardando um motorista aceitar.</p>
              </div>
              <button onClick={handleClear} className="text-xs text-slate-500 underline">Cancelar</button>
            </div>
          )}

          {rideStatus === 'accepted' && (
            <div className="py-4 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Car className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Motorista a caminho!</h3>
              <p className="text-xs text-slate-400">Indo até {selectedName}</p>
              <button onClick={handleClear} className="text-xs text-slate-500 underline">Voltar ao início</button>
            </div>
          )}
        </div>
      )}

      {userRole === 'driver' && !incomingRide && (
        <div className="relative z-20 p-4 pb-8 space-y-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 rounded-t-3xl shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Ganhos totais</p>
              <p className="text-lg font-black text-emerald-400">R$ {driverEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Corridas feitas</p>
              <p className="text-lg font-black text-cyan-400">{driverRidesCount}</p>
            </div>
          </div>

          {!driverActiveRide ? (
            <button
              onClick={() => setIsDriverOnline(!isDriverOnline)}
              className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${
                isDriverOnline ? 'bg-red-500/20 border border-red-500 text-red-300' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950'
              }`}
            >
              {isDriverOnline ? 'FICAR OFFLINE' : 'FICAR ONLINE'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-center text-slate-400">Corrida em andamento até <strong className="text-slate-100">{selectedName}</strong></p>
              <button onClick={handleFinishDriverRide} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-black text-slate-950 text-sm">
                FINALIZAR CORRIDA
              </button>
            </div>
          )}

          {isDriverOnline && !driverActiveRide && (
            <p className="text-center text-[11px] text-slate-500">Você está online e visível para passageiros próximos.</p>
          )}
        </div>
      )}
    </div>
  );
}
