path = "src/App.tsx"
with open(path) as f:
    content = f.read()

def replace_once(old, new, label):
    global content
    count = content.count(old)
    if count != 1:
        print(f"AVISO: '{label}' encontrado {count} vez(es) — esperado 1. Pulei essa parte.")
        return
    content = content.replace(old, new)
    print(f"OK: {label}")

# 1. Remover constantes agora não usadas (RODOVIARIA_COORDS e SAMPLE_ROUTE_PATOS)
replace_once(
    """const RODOVIARIA_COORDS: [number, number] = [-7.0185, -37.2722];

// Pontos intermediários para formar a curva da rota nas ruas de Patos
const SAMPLE_ROUTE_PATOS: [number, number][] = [
  MATERNIDADE_COORDS,
  [-7.0280, -37.2810],
  [-7.0253, -37.2801], // Centro
  [-7.0220, -37.2760],
  RODOVIARIA_COORDS
];""",
    "",
    "remover constantes não usadas"
)

# 2. Adicionar estados novos (rideId, lastFareEarned)
replace_once(
    "const [estimatedPrice, setEstimatedPrice] = useState<number>(0);",
    """const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [rideId, setRideId] = useState<string | null>(null);
  const [lastFareEarned, setLastFareEarned] = useState<number>(0);""",
    "novos estados (rideId, lastFareEarned)"
)

# 3. Ampliar select do perfil para trazer ganhos/corridas reais do motorista
replace_once(
    """    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });""",
    """    supabase
      .from('profiles')
      .select('full_name, avatar_url, driver_earnings, driver_rides_count')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setDriverEarnings(Number(data.driver_earnings) || 0);
          setDriverRidesCount(Number(data.driver_rides_count) || 0);
        }
      });""",
    "buscar ganhos/corridas reais do perfil"
)

# 4. Trocar o gerador falso de corrida por uma escuta em tempo real de corridas reais
replace_once(
    """  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
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
  }, [userRole, isDriverOnline, incomingRide, driverActiveRide]);""",
    """  useEffect(() => {
    if (userRole !== 'driver' || !isDriverOnline || driverActiveRide) return;

    const channel = supabase
      .channel('driver-new-rides')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.searching' },
        async (payload) => {
          const ride = payload.new as any;
          const { data: passengerProfile } = await supabase
            .from('profiles')
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
            pickupCoords: [ride.pickup_lat, ride.pickup_lng] as [number, number],
            coords: [ride.dropoff_lat, ride.dropoff_lng] as [number, number],
          });
          setTimeLeft(INITIAL_TIMER_SECONDS);
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  }, [session, userRole, isDriverOnline, originCoords]);""",
    "escuta real de novas corridas + status do motorista"
)

# 5. Pedido de corrida real (passageiro)
replace_once(
    """  const handleRequestRide = () => {
    setRideStatus('searching');
    setTimeout(() => {
      setRideStatus('accepted');
    }, 4000);
  };""",
    """  const handleRequestRide = async () => {
    if (!session?.user || !originCoords || !selectedCoords) return;
    setRideStatus('searching');

    const lat1 = originCoords[0], lon1 = originCoords[1];
    const lat2 = selectedCoords[0], lon2 = selectedCoords[1];
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const finalFare = estimatedPrice * VEHICLE_OPTIONS.find(v => v.id === selectedCategory)!.multiplier;

    const { data, error } = await supabase
      .from('rides')
      .insert({
        passenger_id: session.user.id,
        status: 'searching',
        pickup_lat: lat1, pickup_lng: lon1, pickup_name: 'Sua localização',
        dropoff_lat: lat2, dropoff_lng: lon2, dropoff_name: selectedName,
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
        (payload) => {
          if ((payload.new as any).status === 'accepted') setRideStatus('accepted');
        }
      )
      .subscribe();

    setTimeout(() => supabase.removeChannel(channel), 5 * 60 * 1000);
  };""",
    "pedido de corrida real"
)

# 6. Aceite de corrida real (motorista)
replace_once(
    """  const handleAcceptRide = () => {
    if (incomingRide) {
      setOriginCoords(incomingRide.pickupCoords);
      setSelectedCoords(incomingRide.coords);
      setSelectedName(incomingRide.dropoff);
      setActiveRoute(SAMPLE_ROUTE_PATOS);
    }
    setIncomingRide(null);
    setDriverActiveRide(true);
  };""",
    """  const handleAcceptRide = async () => {
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
    setActiveRoute(
      originCoords ? [originCoords, incomingRide.pickupCoords, incomingRide.coords] : [incomingRide.pickupCoords, incomingRide.coords]
    );
    setIncomingRide(null);
    setDriverActiveRide(true);
  };""",
    "aceite de corrida real"
)

# 7. Finalizar corrida com dados reais
replace_once(
    """  const handleFinishDriverRide = () => {
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
  };""",
    """  const handleFinishDriverRide = async () => {
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
    setRideId(null);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
  };""",
    "finalizar corrida com dados reais"
)

# 8. Limpar rideId ao cancelar busca de destino
replace_once(
    """  const handleClear = () => {
    setDestination('');
    setSuggestions([]);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setRideStatus('idle');
  };""",
    """  const handleClear = () => {
    setDestination('');
    setSuggestions([]);
    setSelectedCoords(null);
    setSelectedName('');
    setActiveRoute([]);
    setRideStatus('idle');
    setRideId(null);
  };""",
    "limpar rideId ao cancelar"
)

# 9. Mostrar valor real de ganho no toast de sucesso
replace_once(
    '<p className="text-[11px] font-medium text-emerald-100">+ R$ 14,20 adicionados aos seus ganhos</p>',
    '<p className="text-[11px] font-medium text-emerald-100">+ R$ {lastFareEarned.toFixed(2)} adicionados aos seus ganhos</p>',
    "toast com valor real"
)

with open(path, 'w') as f:
    f.write(content)

print("\\nPatch da Fase 3 finalizado!")
