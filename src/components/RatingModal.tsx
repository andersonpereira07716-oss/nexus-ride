import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Star, X } from 'lucide-react';

interface RatingModalProps {
  rideId: string;
  raterId: string;
  rateeId: string;
  rateeName: string;
  onClose: () => void;
}

export function RatingModal({ rideId, raterId, rateeId, rateeName, onClose }: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    await supabase.from('ratings').insert({
      ride_id: rideId,
      rater_id: raterId,
      ratee_id: rateeId,
      stars,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-slate-500">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-slate-100 text-center mb-1">Como foi a corrida?</h2>
        <p className="text-xs text-slate-400 text-center mb-5">Avalie {rateeName}</p>

        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHoverStars(n)}
              onMouseLeave={() => setHoverStars(0)}
            >
              <Star
                className={`w-8 h-8 ${
                  n <= (hoverStars || stars) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Deixe um comentário (opcional)"
          rows={3}
          className="w-full p-3 bg-slate-950/80 border border-slate-700 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-4 resize-none"
        />

        <button
          onClick={handleSubmit}
          disabled={stars === 0 || submitting}
          className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-white text-sm disabled:opacity-40"
        >
          {submitting ? 'Enviando...' : 'Enviar avaliação'}
        </button>
        <button onClick={onClose} className="w-full text-center text-xs text-slate-500 mt-3">
          Pular
        </button>
      </div>
    </div>
  );
}
