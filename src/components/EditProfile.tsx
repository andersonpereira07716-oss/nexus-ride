import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, User, Phone, Camera } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

interface EditProfileProps {
  session: Session;
  currentName: string;
  currentPhone: string | null;
  currentAvatar: string | null;
  onClose: () => void;
  onSaved: (name: string, avatarUrl: string | null) => void;
}

export function EditProfile({ session, currentName, currentPhone, currentAvatar, onClose, onSaved }: EditProfileProps) {
  const [fullName, setFullName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');

    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setErrorMsg('Erro ao enviar foto: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl + '?t=' + Date.now());
    setUploading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, avatar_url: avatarUrl })
      .eq('id', session.user.id);

    setSaving(false);
    if (error) {
      setErrorMsg('Erro ao salvar: ' + error.message);
      return;
    }
    onSaved(fullName.trim(), avatarUrl);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80">
        <h2 className="text-base font-bold text-slate-100">Editar Perfil</h2>
        <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-cyan-500/50 overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-500" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center cursor-pointer border-2 border-slate-950">
              <Camera className="w-4 h-4 text-slate-950" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
            </label>
          </div>
          {uploading && <p className="text-[10px] text-cyan-400 mt-2">Enviando foto...</p>}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">Nome completo</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">Telefone</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-xl p-3">{errorMsg}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !fullName.trim()}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl font-bold text-white text-sm disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
