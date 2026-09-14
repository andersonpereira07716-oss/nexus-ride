import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Car, ShieldCheck, MapPin } from 'lucide-react';

export function App() {
  const [session, setSession] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error("Erro ao carregar sessão:", error);
      } finally {
        setIsReady(true);
      }
    };

    initApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-3 border border-blue-500/30">
          <Car className="w-8 h-8 text-blue-400 animate-pulse" />
        </div>
        <h1 className="text-xl font-bold tracking-wide">Nexus Ride</h1>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <Car className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">Nexus Ride</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Sistema Seguro Ativo
            </p>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors text-slate-400 text-sm font-medium"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full flex flex-col items-center justify-center text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-xl">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <MapPin className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Bem-vindo ao Nexus Ride!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Sua sessão está autenticada com segurança.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 break-all">
            Logado como: {session.user?.email}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
