path = "src/App.tsx"
with open(path) as f:
    content = f.read()

old_state = "const [originCoords, setOriginCoords] = useState<[number, number] | null>(MATERNIDADE_COORDS);"
new_state = "const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);\n  const [locationError, setLocationError] = useState<string | null>(null);"
content = content.replace(old_state, new_state)

anchor = "  const playNotificationSound = () => {"
geo_effect = '''  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada neste navegador.');
      setOriginCoords(MATERNIDADE_COORDS);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setOriginCoords([position.coords.latitude, position.coords.longitude]);
        setLocationError(null);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        setLocationError('Não foi possível obter sua localização. Ative o GPS e permita o acesso.');
        setOriginCoords(MATERNIDADE_COORDS);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

''' + anchor

content = content.replace(anchor, geo_effect)

with open(path, 'w') as f:
    f.write(content)

print("Patch aplicado com sucesso!")
