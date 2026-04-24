import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { motion } from 'motion/react';
import { User, Mail, Phone, MapPin, Sparkles, Save, Send } from 'lucide-react';
import { AKTAU_REGIONS } from '../constants';

interface SeekerProfileProps {
  userId: string;
  email: string;
  initialProfile?: UserProfile | null;
  isInitialSetup?: boolean;
  onComplete: (profile: UserProfile) => void;
}

export default function SeekerProfile({ userId, email, initialProfile, isInitialSetup, onComplete }: SeekerProfileProps) {
  const [role, setRole] = useState<UserRole>(initialProfile?.role || 'seeker');
  const [name, setName] = useState(initialProfile?.name || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [skills, setSkills] = useState(initialProfile?.skills?.join(', ') || '');
  const [location, setLocation] = useState(initialProfile?.location || '');
  const [telegramId, setTelegramId] = useState(initialProfile?.telegramId || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const profileData: UserProfile = {
      userId,
      role,
      name,
      email,
      phone,
      bio,
      skills: skills.split(',').map(s => s.trim()).filter(s => s),
      location,
      telegramId,
      createdAt: initialProfile?.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', userId), {
        ...profileData,
        updatedAt: serverTimestamp(),
        createdAt: initialProfile ? initialProfile.createdAt : serverTimestamp()
      });
      onComplete(profileData);
    } catch (err) {
      console.error("Save profile error:", err);
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl bg-white rounded-3xl p-8 border border-slate-100 shadow-xl"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isInitialSetup ? 'Добро пожаловать!' : 'Настройки профиля'}
        </h2>
        <p className="text-slate-500 text-sm font-medium">
          {isInitialSetup ? 'Расскажите о себе, чтобы мы подобрали лучшие вакансии' : 'Обновите вашу информацию для точного AI-матчинга'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isInitialSetup && (
          <div className="flex gap-3 p-1.5 bg-slate-100 rounded-2xl">
            <button 
              type="button"
              onClick={() => setRole('seeker')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${role === 'seeker' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Я соискатель
            </button>
            <button 
              type="button"
              onClick={() => setRole('employer')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${role === 'employer' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Я работодатель
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Как вас зовут?</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00529B]"
                placeholder="Имя Фамилия"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Телефон</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00529B]"
                placeholder="+7 (___) ___ __ __"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Район проживания (Актау)</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none appearance-none"
            >
              <option value="">Выберите микрорайон</option>
              {AKTAU_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {role === 'seeker' && (
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Навыки (через запятую)</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-3 text-slate-400" size={16} />
              <textarea 
                value={skills} 
                onChange={(e) => setSkills(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none h-24"
                placeholder="Напр: Продажи, Касса, Excel, Казахский язык, Коммуникабельность"
              />
            </div>
            <p className="text-[10px] text-blue-500 mt-2 font-bold italic">* AI будет использовать эти навыки для подбора вакансий</p>
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">О себе / О компании</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none h-24"
            placeholder="Краткая информация..."
          />
        </div>

        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-2">Интеграция с Telegram</label>
          <div className="relative">
            <Send className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
            <input 
              type="text" 
              value={telegramId} 
              onChange={(e) => setTelegramId(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-blue-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              placeholder="@username"
            />
          </div>
          <p className="text-[11px] text-blue-600 mt-2 font-medium">Мы сообщим вам о новых откликах и сообщениях</p>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50 shadow-lg text-sm"
        >
          <Save size={18} />
          {loading ? 'Сохранение...' : 'Завершить настройку'}
        </button>
      </form>
    </motion.div>
  );
}
