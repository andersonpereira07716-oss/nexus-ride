path = "src/App.tsx"
with open(path) as f:
    content = f.read()

# 1. Imports
old_import = "import { InteractiveMap } from './components/InteractiveMap';"
new_import = """import { InteractiveMap } from './components/InteractiveMap';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';"""
content = content.replace(old_import, new_import)

# 2. Novo estado de sessão e perfil, logo após userRole
old_state = "export default function App() {\n  const [userRole, setUserRole] = useState<'passenger' | 'driver'>('passenger');"
new_state = """export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<'passenger' | 'driver'>('passenger');"""
content = content.replace(old_state, new_state)

# 3. useEffect de sessão + busca de perfil, logo após a abertura da função
anchor = "  const playNotificationSound = () => {"
auth_effect = '''  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
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
      .select('full_name, avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

''' + anchor

content = content.replace(anchor, auth_effect)

# 4. Bloqueio de tela: mostra loading ou tela de login antes do app
old_return_start = "  return (\n    <div className=\"relative h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col\">"
new_return_start = """  if (authLoading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="relative h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col">"""
content = content.replace(old_return_start, new_return_start)

# 5. Nome real no header (troca "Anderson Silva" fixo pelo nome do perfil)
old_name = '<p className="text-sm font-bold tracking-wide text-slate-100">Anderson Silva 👋</p>'
new_name = '<p className="text-sm font-bold tracking-wide text-slate-100">{profile?.full_name || session.user.email} 👋</p>'
content = content.replace(old_name, new_name)

# 6. Botão de sair, ao lado do botão Modo Motorista
old_header_btns = '''            <span>{userRole === 'passenger' ? 'Modo Motorista' : 'Modo Passageiro'}</span>
          </button>
        </div>
      </header>'''
new_header_btns = '''            <span>{userRole === 'passenger' ? 'Modo Motorista' : 'Modo Passageiro'}</span>
          </button>
          <button
            onClick={handleSignOut}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400"
          >
            Sair
          </button>
        </div>
      </header>'''
content = content.replace(old_header_btns, new_header_btns)

with open(path, 'w') as f:
    f.write(content)

print("Patch de autenticação aplicado!")
