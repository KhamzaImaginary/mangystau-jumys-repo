import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Application, Job, UserProfile, JobAlert } from '../types';
import { FileText, Clock, CheckCircle2, XCircle, MapPin, Briefcase, MessageSquare, Bell, Trash2, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INDUSTRIES, AKTAU_REGIONS } from '../constants';

interface SeekerDashboardProps {
  profile: UserProfile;
}

export default function SeekerDashboard({ profile }: SeekerDashboardProps) {
  const [applications, setApplications] = useState<(Application & { job?: Job })[]>([]);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applications' | 'alerts'>('applications');

  // Alert Form State
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [alertIndustry, setAlertIndustry] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertKeywords, setAlertKeywords] = useState('');

  useEffect(() => {
    if (profile?.userId) {
      fetchData();
    }
  }, [profile?.userId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchApplications(), fetchAlerts()]);
    setLoading(false);
  };

  const fetchAlerts = async () => {
    try {
      const q = query(collection(db, 'job_alerts'), where('userId', '==', profile.userId));
      const querySnapshot = await getDocs(q);
      const alertData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as JobAlert));
      setAlerts(alertData);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'job_alerts'), {
        userId: profile.userId,
        industry: alertIndustry || null,
        location: alertLocation || null,
        keywords: alertKeywords || null,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setAlertIndustry('');
      setAlertLocation('');
      setAlertKeywords('');
      setShowAddAlert(false);
      fetchAlerts();
    } catch (error) {
      console.error("Error adding alert:", error);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'job_alerts', id));
      fetchAlerts();
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  const fetchApplications = async () => {
    try {
      const q = query(collection(db, 'applications'), where('seekerId', '==', profile.userId));
      const querySnapshot = await getDocs(q);
      
      const apps: any[] = [];
      for (const d of querySnapshot.docs) {
        const appData = { id: d.id, ...d.data() } as Application;
        
        // Fetch job details
        const jobRef = doc(db, 'jobs', appData.jobId);
        const jobSnap = await getDoc(jobRef);
        const jobData = jobSnap.exists() ? { id: jobSnap.id, ...jobSnap.data() } as Job : undefined;
        
        apps.push({ ...appData, job: jobData });
      }
      
      // Sort by creation date descending
      apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setApplications(apps);
    } catch (error) {
      console.error("Error fetching seeker applications:", error);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'viewed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'Принят';
      case 'rejected': return 'Отклонен';
      case 'pending': return 'На рассмотрении';
      case 'viewed': return 'Просмотрено';
      case 'shortlisted': return 'В шорт-листе';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <div key={`seeker-skeleton-${i}`} className="bg-white rounded-3xl h-40 animate-pulse border border-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'applications' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Отклики
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'alerts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Уведомления (Alerts)
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'applications' ? (
          <motion.div
            key="apps-tab"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Мои отклики</h2>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                Всего: {applications.length}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-slate-300" size={32} />
                </div>
                <p className="text-slate-500 font-medium italic">Вы еще не откликались на вакансии</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {applications.map((app, idx) => (
                  <motion.div 
                    key={app.id || `app-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:border-blue-300 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(app.status)}`}>
                            {getStatusText(app.status)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock size={10} /> {new Date(app.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{app.job?.title || 'Вакансия удалена'}</h3>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                          <span className="flex items-center gap-1"><Briefcase size={14} /> {app.job?.industry || '---'}</span>
                          <span className="flex items-center gap-1"><MapPin size={14} /> {app.job?.location.microdistrict || '---'}</span>
                        </div>
                      </div>
                      
                      <div className="md:text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 italic">Ваше сообщение:</p>
                        <p className="text-sm text-slate-600 font-medium italic">"{app.message || 'Без сообщения'}"</p>
                      </div>
                    </div>

                    {app.reasoning && (
                      <div className="mt-6 p-5 bg-blue-50 rounded-2xl border border-blue-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                          <MessageSquare size={48} />
                        </div>
                        <div className="relative">
                          <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-widest mb-2">
                             <MessageSquare size={14} /> Ответ работодателя:
                          </div>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed">
                            {app.reasoning}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="alerts-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="text-blue-600" /> Уведомления о вакансиях
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Настройте фильтры, чтобы первыми узнавать о подходящей работе через Telegram.
                </p>
              </div>
              <div className="flex gap-2">
                {!profile.telegramId && (
                  <a 
                    href={`https://t.me/mangystau_jumys_bot?start=${profile.userId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 py-3 bg-slate-100 text-blue-600 border border-blue-200 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-all"
                  >
                    <MessageSquare size={18} /> Подключить Telegram
                  </a>
                )}
                <button 
                  onClick={() => setShowAddAlert(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <Plus size={18} /> Создать алерт
                </button>
              </div>
            </div>

            {!profile.telegramId && (
              <div className="bg-blue-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-blue-100">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                  <MessageSquare size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="max-w-md">
                    <h3 className="text-xl font-bold mb-2">Получайте вакансии мгновенно!</h3>
                    <p className="text-blue-100 text-sm">
                      Подключите Telegram, чтобы получать уведомления о новых вакансиях и статусах ваших откликов прямо в мессенджер. Это бесплатно и удобно.
                    </p>
                  </div>
                  <a 
                    href={`https://t.me/mangystau_jumys_bot?start=${profile.userId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold text-sm shadow-lg hover:scale-105 transition-transform whitespace-nowrap"
                  >
                    🚀 Подключить Бот
                  </a>
                </div>
              </div>
            )}

            {showAddAlert && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Новое уведомление</h3>
                  
                  <form onSubmit={handleAddAlert} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Сфера деятельности</label>
                      <select 
                        value={alertIndustry} 
                        onChange={(e) => setAlertIndustry(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none appearance-none"
                      >
                        <option value="">Любая сфера</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Микрорайон</label>
                      <select 
                        value={alertLocation} 
                        onChange={(e) => setAlertLocation(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none appearance-none"
                      >
                        <option value="">Весь город</option>
                        {AKTAU_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Ключевые слова (через запятую)</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          value={alertKeywords} 
                          onChange={(e) => setAlertKeywords(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Повар, Бариста, ИТ..."
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        type="button"
                        onClick={() => setShowAddAlert(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200"
                      >
                        Отмена
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700"
                      >
                        Создать
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {alerts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Bell size={32} />
                </div>
                <p className="text-slate-500 font-medium mb-1">У вас пока нет настроенных алертов</p>
                <p className="text-xs text-slate-400">Создайте алерт, чтобы получать вакансии прямо в Telegram</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((alert, idx) => (
                  <div key={alert.id || `alert-${idx}`} className="bg-white rounded-3xl p-6 border border-slate-200 flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                          <Bell size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Рабочий алерт</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <Briefcase size={12} className="text-slate-400" />
                          <span className="font-bold text-slate-700">{alert.industry || 'Любая сфера'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <MapPin size={12} className="text-slate-400" />
                          <span>{alert.location || 'Весь город'}</span>
                        </div>
                        {alert.keywords && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Search size={12} className="text-slate-400" />
                            <span className="italic">"{alert.keywords}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
