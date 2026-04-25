import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Job, UserProfile, Application } from '../types';
import { matchJobsWithSeeker } from '../services/aiService';
import JobCard from './JobCard';
import { Search, Filter, Sparkles, MapPin, Briefcase } from 'lucide-react';
import { INDUSTRIES, AKTAU_REGIONS } from '../constants';

interface JobBoardProps {
  profile: UserProfile;
}

export default function JobBoard({ profile }: JobBoardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [useAI, setUseAI] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  useEffect(() => {
    fetchJobs();
  }, [selectedIndustry, selectedRegion]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'jobs'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(50));
      
      if (selectedIndustry) {
        q = query(collection(db, 'jobs'), 
          where('status', '==', 'open'), 
          where('industry', '==', selectedIndustry),
          limit(50)
        );
      }

      const querySnapshot = await getDocs(q);
      let fetchedJobs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      
      // Filter by region if selected (since Firestore doesn't support deep field filtering easily with orderBy in some cases without complex indexes)
      if (selectedRegion) {
        fetchedJobs = fetchedJobs.filter(j => j.location.microdistrict === selectedRegion);
      }

      setJobs(fetchedJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
    setLoading(false);
  };

  const handleAIMatch = async () => {
    if (useAI) {
      setUseAI(false);
      fetchJobs();
      return;
    }
    
    setLoading(true);
    const matched = await matchJobsWithSeeker(jobs, profile);
    setJobs(matched as any);
    setUseAI(true);
    setLoading(false);
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApply = async (jobId: string, employerId: string, message: string) => {
    try {
      const job = jobs.find(j => j.id === jobId);
      await addDoc(collection(db, 'applications'), {
        jobId,
        employerId,
        seekerId: profile.userId,
        status: 'pending',
        message,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Notify employer via backend
      if (job) {
        fetch('/api/notify-employer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employerId,
            jobTitle: job.title,
            seekerName: profile.name,
            message: message
          })
        }).catch(err => console.error("Notification failed:", err));
      }

      alert('Отклик успешно отправлен!');
    } catch (err) {
      console.error("Apply error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Поиск по ключевым словам</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Название, навыки или компания..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="w-full md:w-56">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Сфера</label>
          <select 
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
          >
            <option value="">Все сферы</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="w-full md:w-56">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Микрорайон</label>
          <select 
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
          >
            <option value="">Весь Актау</option>
            {AKTAU_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <button 
          onClick={handleAIMatch}
          className={`h-[48px] px-8 rounded-full font-bold flex items-center justify-center gap-2 transition-all shadow-sm w-full md:w-auto ${
            useAI ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600'
          }`}
        >
          <Sparkles size={18} />
          {useAI ? 'AI On' : 'AI Match'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Вакансии в Актау</h2>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Обновлено только что</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={`job-skeleton-${i}`} className="bg-white rounded-2xl h-64 animate-pulse border border-slate-100" />
          ))
        ) : filteredJobs.length > 0 ? (
          filteredJobs.map((job, idx) => (
            <JobCard key={job.id || `job-${idx}`} job={job} onApply={handleApply} seekerProfile={profile} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-400 font-medium">
            Ничего не найдено по вашему запросу
          </div>
        )}
      </div>
    </div>
  );
}
