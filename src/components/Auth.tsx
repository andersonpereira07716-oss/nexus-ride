import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Car } from 'lucide-react';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mb-6">
        <Car className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-black mb-1">Nexus Ride</h1>
      <p className="text-sm text-slate-400 mb-8">
        {isSignUp ? 'Crie sua conta' : 'Entre na sua conta'}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        {isSignUp && (
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-xl p-3">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-sm disabled:opacity-50"
        >
          {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <button
        onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
        className="mt-6 text-xs text-slate-400"
      >
        {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar agora'}
      </button>
    </div>
  );
}
