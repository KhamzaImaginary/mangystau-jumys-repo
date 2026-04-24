import { UserProfile } from '../types';
import { auth } from '../lib/firebase';
import { Briefcase, LayoutDashboard, User, LogOut } from 'lucide-react';

interface NavbarProps {
  profile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: 'board' | 'dashboard' | 'profile' | 'seeker-apps') => void;
}

export default function Navbar({ profile, activeTab, setActiveTab }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8">
      <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('board')}>
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            MJ
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">Маңғыстау Жұмыс</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Цифровая Платформа</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <button 
            onClick={() => setActiveTab('board')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all ${
              activeTab === 'board' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Вакансии
          </button>
          {profile.role === 'seeker' && (
            <button 
              onClick={() => setActiveTab('seeker-apps')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all ${
                activeTab === 'seeker-apps' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Мои отклики
            </button>
          )}
          {profile.role === 'employer' && (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all ${
                activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Панель управления
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 transition-all p-1.5 rounded-full ${
              activeTab === 'profile' ? 'bg-blue-50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="text-right hidden lg:block">
              <div className="text-sm font-bold text-slate-900">{profile.name}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 opacity-80">
                {profile.role === 'employer' ? 'Работодатель' : 'Соискатель'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center overflow-hidden text-blue-700 font-bold text-xs text-center uppercase">
              {profile.name[0]}
            </div>
          </button>
          
          <button 
            onClick={() => auth.signOut()}
            className="p-2 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
