path = "src/App.tsx"
with open(path) as f:
    content = f.read()

old = """  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });"""

new = """  useEffect(() => {
    const safetyTimeout = setTimeout(() => setAuthLoading(false), 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimeout);
      setSession(session);
      setAuthLoading(false);
    }).catch((err) => {
      clearTimeout(safetyTimeout);
      console.error('Erro ao verificar sessão:', err);
      setAuthLoading(false);
    });"""

content = content.replace(old, new)

with open(path, 'w') as f:
    f.write(content)

print("Patch aplicado!")
