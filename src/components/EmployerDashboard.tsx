import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Job, UserProfile, Application } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, LayoutDashboard, FileText, CheckCircle2, XCircle, Trash2, MapPin, Briefcase, Send, MessageSquare } from 'lucide-react';
import { INDUSTRIES, AKTAU_REGIONS } from '../constants';

interface EmployerDashboardProps {
  profile: UserProfile;
}

export default function EmployerDashboard({ profile }: EmployerDashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<(Application & { seekerProfile?: UserProfile, jobTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'jobs' | 'apps' | 'post' | 'telegram'>('jobs');
  const [botActive, setBotActive] = useState<boolean | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [microdistrict, setMicrodistrict] = useState('');
  const [jobType, setJobType] = useState<'full-time' | 'part-time' | 'gig' | 'internship'>('full-time');
  const [experience, setExperience] = useState<'no-experience' | '1-3-years' | '3-plus-years'>('no-experience');
  const [salary, setSalary] = useState('');

  useEffect(() => {
    if (profile?.userId) {
      fetchData();
      checkBotStatus();
    }
  }, [profile?.userId]);

  const checkBotStatus = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setBotActive(!!data.botActive);
    } catch (e) {
      setBotActive(false);
    }
  };

  const fetchData = async () => {
    if (!profile?.userId) return;
    setLoading(true);
    console.log("Fetching data for employer:", profile.userId);
    try {
      // Fetch Jobs
      const jobsQ = query(collection(db, 'jobs'), where('employerId', '==', profile.userId));
      const jobsSnap = await getDocs(jobsQ);
      const fetchedJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      setJobs(fetchedJobs);
      console.log("Fetched jobs:", fetchedJobs.length);

      // Fetch Applications (Only by employerId for performance and rules compatibility)
      const appsQ = query(collection(db, 'applications'), where('employerId', '==', profile.userId));
      const appsSnap = await getDocs(appsQ);
      console.log("Fetched apps via employerId:", appsSnap.size);
      
      const allApps: any[] = [];
      const processedAppData = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      for (const appData of processedAppData as any[]) {
        // Find job title
        const job = fetchedJobs.find(j => j.id === appData.jobId);
        let jobTitle = job?.title;

        if (!jobTitle) {
          try {
            const jRef = doc(db, 'jobs', appData.jobId);
            const jSnap = await getDoc(jRef);
            jobTitle = jSnap.exists() ? (jSnap.data() as any).title : 'Unknown Job';
          } catch (e) {
            jobTitle = 'Unknown Job';
          }
        }
        
        // Fetch seeker profile
        let sProfile: UserProfile | undefined = undefined;
        try {
          const sRef = doc(db, 'users', appData.seekerId);
          const sSnap = await getDoc(sRef);
          sProfile = sSnap.exists() ? { ...sSnap.data(), userId: appData.seekerId } as UserProfile : undefined;
        } catch (e) {
          console.error("Error fetching seeker profile:", e);
        }
        
        allApps.push({ 
          ...appData, 
          seekerProfile: sProfile,
          jobTitle: jobTitle
        });
      }
      setApplications(allApps);
    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      // alert(`Ошибка доступа: ${err.message}`);
    }
    setLoading(false);
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const jobData = {
        employerId: profile.userId,
        title,
        description,
        industry,
        skills: description.split(',').map(s => s.trim()).filter(s => s),
        location: { city: 'Aktau', microdistrict },
        jobType,
        experience,
        salary,
        status: 'open',
        createdAt: new Date().toISOString() // Using string date for the alert API payload
      };

      const docRef = await addDoc(collection(db, 'jobs'), {
        ...jobData,
        createdAt: serverTimestamp() // Firestore server timestamp
      });

      // Trigger alerts check via backend
      fetch('/api/check-job-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: { ...jobData, id: docRef.id } })
      }).catch(err => console.error("Alerts check failed:", err));

      setTitle('');
      setDescription('');
      setActiveView('jobs');
      fetchData();
    } catch (err) {
      console.error("Post job error:", err);
    }
    setLoading(false);
  };

  const [showReasoningModal, setShowReasoningModal] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string>('');

  const handleUpdateAppStatus = async (appId: string, status: string, reasoningText?: string) => {
    try {
      const app = applications.find(a => a.id === appId);
      
      await updateDoc(doc(db, 'applications', appId), { 
        status, 
        reasoning: reasoningText || '',
        updatedAt: serverTimestamp() 
      });

      // Notify seeker via backend
      if (app) {
        fetch('/api/notify-seeker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seekerId: app.seekerId,
            jobTitle: app.jobTitle,
            status,
            reasoning: reasoningText
          })
        }).catch(err => console.error("Seeker notification failed:", err));
      }

      fetchData();
      setShowReasoningModal(null);
      setReasoning('');
    } catch (err) {
      console.error("Update app error:", err);
    }
  };

  const openReasoningModal = (appId: string, status: string) => {
    setShowReasoningModal(appId);
    setPendingStatus(status);
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту вакансию?')) return;
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      fetchData();
    } catch (err) {
      console.error("Delete job error:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-3">
        <button 
          onClick={() => setActiveView('jobs')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm tracking-tight ${
            activeView === 'jobs' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <LayoutDashboard size={18} />
          Мои вакансии
        </button>
        <button 
          onClick={() => setActiveView('apps')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm tracking-tight ${
            activeView === 'apps' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText size={18} />
          Отклики {applications.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{applications.length}</span>}
        </button>
        <button 
          onClick={() => setActiveView('post')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm tracking-tight ${
            activeView === 'post' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Plus size={18} />
          Разместить вакансию
        </button>
        <button 
          onClick={() => setActiveView('telegram')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm tracking-tight ${
            activeView === 'telegram' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <MessageSquare size={18} />
          Telegram уведомления
        </button>
      </div>

      <div className="lg:col-span-3">
        {activeView === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Мои вакансии</h2>
              <button 
                onClick={() => setActiveView('post')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors"
              >
                + Добавить
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="text-slate-300" size={32} />
                </div>
                <p className="text-slate-500 font-medium italic">У вас пока нет активных вакансий</p>
                <button onClick={() => setActiveView('post')} className="mt-4 text-blue-600 font-bold hover:underline">Добавить первую</button>
              </div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="bg-white rounded-3xl p-6 border border-slate-200 flex items-center justify-between shadow-sm hover:border-blue-300 transition-all">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{job.title}</h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><MapPin size={12}/> {job.location.microdistrict}</span>
                      <span className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 size={12}/> {job.status === 'open' ? 'Активна' : 'Закрыта'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDeleteJob(job.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeView === 'apps' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Отклики кандидатов</h2>
            {applications.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <p className="text-slate-500 font-medium italic">Пока никто не откликнулся</p>
              </div>
            ) : (
              applications.map(app => (
                <div key={app.id} className="bg-white rounded-3xl p-6 border border-slate-200 mb-4 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {app.seekerProfile?.name[0]}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Отклик на: <span className="text-blue-600">{app.jobTitle}</span>
                        </div>
                        <h3 className="font-bold text-xl text-slate-900">{app.seekerProfile?.name || 'Кандидат'}</h3>
                        <p className="text-slate-500 text-sm font-medium">{app.seekerProfile?.email} • {app.seekerProfile?.phone}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                      app.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {app.status === 'pending' ? 'На рассмотрении' : app.status === 'accepted' ? 'Принят' : 'Отклонен'}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-2xl mb-6 text-sm font-medium text-slate-600 border border-slate-100 italic">
                    "{app.message || 'Без сопроводительного письма'}"
                  </div>

                  {app.reasoning && (
                    <div className="p-4 bg-blue-50 rounded-2xl mb-6 text-sm font-medium text-blue-700 border border-blue-100">
                      <span className="font-bold">Ваш ответ (причина):</span> {app.reasoning}
                    </div>
                  )}
                  
                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openReasoningModal(app.id, 'accepted')}
                        className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600"
                      >
                        <CheckCircle2 size={16} /> Принять
                      </button>
                      <button 
                        onClick={() => openReasoningModal(app.id, 'rejected')}
                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50"
                      >
                        <XCircle size={16} /> Отклонить
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {showReasoningModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {pendingStatus === 'accepted' ? 'Принять кандидата' : 'Отклонить кандидата'}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    {pendingStatus === 'accepted' 
                      ? 'Укажите причину или приветственное сообщение (необязательно). Кандидат получит уведомление.' 
                      : 'Укажите причину отказа (необязательно). Это поможет соискателю понять, что пошло не так.'}
                  </p>
                  
                  <textarea 
                    value={reasoning}
                    onChange={(e) => setReasoning(e.target.value)}
                    className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium mb-6"
                    placeholder="Напишите здесь..."
                  />

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowReasoningModal(null)}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200"
                    >
                      Отмена
                    </button>
                    <button 
                      onClick={() => handleUpdateAppStatus(showReasoningModal, pendingStatus, reasoning)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg ${pendingStatus === 'accepted' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                    >
                      {pendingStatus === 'accepted' ? 'Подтвердить прием' : 'Подтвердить отказ'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {activeView === 'post' && (
          <form onSubmit={handlePostJob} className="bg-white rounded-3xl p-8 border border-slate-200 space-y-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">Новая вакансия</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Название позиции</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Напр: Официант в кафе 'Caspian'"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Сфера</label>
                <select 
                  value={industry} 
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium appearance-none"
                  required
                >
                  <option value="">Выберите сферу</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Описание и навыки (через запятую)</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium h-32"
                placeholder="Расскажите о вакансии. Перечислите навыки через запятую для работы AI-алгоритма."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Микрорайон</label>
                <select 
                  value={microdistrict} 
                  onChange={(e) => setMicrodistrict(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium appearance-none"
                  required
                >
                  <option value="">Выберите район</option>
                  {AKTAU_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Тип занятости</label>
                <select 
                  value={jobType} 
                  onChange={(e) => setJobType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium appearance-none"
                >
                  <option value="full-time">Полный день</option>
                  <option value="part-time">Частичная</option>
                  <option value="gig">Подработка</option>
                  <option value="internship">Стажировка</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Опыт</label>
                <select 
                  value={experience} 
                  onChange={(e) => setExperience(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium appearance-none"
                >
                  <option value="no-experience">Без опыта</option>
                  <option value="1-3-years">1-3 года</option>
                  <option value="3-plus-years">Более 3 лет</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Зарплата</label>
              <input 
                type="text" 
                value={salary} 
                onChange={(e) => setSalary(e.target.value)}
                className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                placeholder="Напр: 150 000 ₸ + бонусы"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 text-sm shadow-lg"
            >
              {loading ? 'Публикация...' : 'Опубликовать вакансию'}
            </button>
          </form>
        )}

        {activeView === 'telegram' && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="text-blue-600" /> Telegram Уведомления
              </h2>
              {botActive === false && (
                <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
                  <XCircle size={14} /> Бот не настроен
                </div>
              )}
            </div>

            {botActive === false && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
                <p className="font-bold mb-1 italic">Внимание администратора!</p>
                <p>Бот не активен. Проверьте правильность <code className="bg-amber-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> в настройках переменных окружения.</p>
              </div>
            )}
            
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Откройте Telegram</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Найдите своего бота в Telegram и запустите его (нажмите <b>Start</b>).
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Отправьте команду</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-3">
                  Скопируйте и отправьте боту следующую команду:
                </p>
                <div className="bg-slate-900 text-white p-3 rounded-xl font-mono text-xs flex items-center justify-between">
                  <span>/link {profile.userId}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`/link ${profile.userId}`);
                      alert('Команда скопирована!');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold"
                  >
                    Копировать
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Статус подключения</h4>
                  <p className="text-xs text-slate-500">
                    {profile.telegramId ? 'Статус: Активен (Уведомления включены)' : 'Статус: Не подключен'}
                  </p>
                </div>
                {profile.telegramId ? (
                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={14} /> Подключено
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-2">
                    <XCircle size={14} /> Ожидание...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
