import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, MapPin, Navigation, Calendar } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

interface RideHistoryItem {
  id: string;
  status: string;
  pickup_name: string;
  dropoff_name: string;
  fare: number;
  category: string;
  created_at: string;
  passenger_id: string;
  driver_id: string | null;
}

export function RideHistory({ session, onClose }: { session: Session; onClose: () => void }) {
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('rides')
      .select('id, status, pickup_name, dropoff_name, fare, category, created_at, passenger_id, driver_id')
      .or(`passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`)
      .in('status', ['completed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRides(data || []);
        setLoading(false);
      });
  }, [session]);

  const statusLabel = (status: string) =>
    status === 'completed' ? 'Concluída' : 'Cancelada';

  const statusColor = (status: string) =>
    status === 'completed' ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' : 'text-red-400 bg-red-950/60 border-red-500/30';

  return (
    <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80">
        <h2 className="text-base font-bold text-slate-100">Histórico de Corridas</h2>
        <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex justify-center pt-10">
            <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && rides.length === 0 && (
          <p className="text-center text-sm text-slate-500 pt-10">Nenhuma corrida no histórico ainda.</p>
        )}

        {rides.map((ride) => {
          const isDriver = ride.driver_id === session.user.id;
          const date = new Date(ride.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return (
            <div key={ride.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {date}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(ride.status)}`}>
                  {statusLabel(ride.status)}
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {ride.pickup_name || 'Origem'}</p>
                <p className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> {ride.dropoff_name || 'Destino'}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500">{isDriver ? 'Como motorista' : 'Como passageiro'} · {ride.category}</span>
                <span className="text-sm font-black text-emerald-400">R$ {Number(ride.fare).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
