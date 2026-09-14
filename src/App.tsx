import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';

export function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#020617', color: '#ffffff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Nexus Ride</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ backgroundColor: '#020617', color: '#ffffff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Nexus Ride</h1>
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ backgroundColor: '#ef4444', color: '#white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
        >
          Sair
        </button>
      </div>
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', textAlign: 'center' }}>
        <h3>Bem-vindo!</h3>
        <p style={{ color: '#94a3b8', marginTop: '8px' }}>Logado como: {session.user?.email}</p>
      </div>
    </div>
  );
}

export default App;
