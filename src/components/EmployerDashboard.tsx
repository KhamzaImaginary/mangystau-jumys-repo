import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Job, UserProfile, Application } from '../types';
import { Plus, LayoutDashboard, FileText, CheckCircle2, XCircle, Trash2, MapPin, Briefcase } from 'lucide-react';
import { INDUSTRIES, AKTAU_REGIONS } from '../constants';

interface EmployerDashboardProps {
  profile: UserProfile;
}

export default function EmployerDashboard({ profile }: EmployerDashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<(Application & { seekerProfile?: UserProfile, jobTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'jobs' | 'apps' | 'post'>('jobs');

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
    }
  }, [profile?.userId]);

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
      const processedAppData = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      for (const appData of processedAppData) {
        // Find job title
        const job = fetchedJobs.find(j => j.id === appData.jobId);
        let jobTitle = job?.title;

        if (!jobTitle) {
          try {
            const jRef = doc(db, 'jobs', appData.jobId);
            const jSnap = await getDoc(jRef);
            jobTitle = jSnap.exists() ? jSnap.data().title : 'Unknown Job';
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
      await addDoc(collection(db, 'jobs'), {
        employerId: profile.userId,
        title,
        description,
        industry,
        skills: description.split(',').map(s => s.trim()).filter(s => s), // Simple skill extraction
        location: { city: 'Aktau', microdistrict },
        jobType,
        experience,
        salary,
        status: 'open',
        createdAt: serverTimestamp()
      });
      setTitle('');
      setDescription('');
      setActiveView('jobs');
      fetchData();
    } catch (err) {
      console.error("Post job error:", err);
    }
    setLoading(false);
  };

  const handleUpdateAppStatus = async (appId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'applications', appId), { 
        status, 
        updatedAt: serverTimestamp() 
      });
      fetchData();
    } catch (err) {
      console.error("Update app error:", err);
    }
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

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateAppStatus(app.id, 'accepted')}
                      className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600"
                    >
                      <CheckCircle2 size={16} /> Принять
                    </button>
                    <button 
                      onClick={() => handleUpdateAppStatus(app.id, 'rejected')}
                      className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50"
                    >
                      <XCircle size={16} /> Отклонить
                    </button>
                  </div>
                </div>
              ))
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
      </div>
    </div>
  );
}
