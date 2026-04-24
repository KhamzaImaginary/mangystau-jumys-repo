import { useState } from 'react';
import { Job, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Briefcase, Clock, ChevronRight, Send, Star, Sparkles } from 'lucide-react';

interface JobCardProps {
  job: any; // includes optional aiScore and aiReason
  onApply: (jobId: string, employerId: string, message: string) => Promise<void>;
  seekerProfile: UserProfile;
}

export default function JobCard({ job, onApply, seekerProfile }: JobCardProps) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [message, setMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);

  const handleApplyClick = async () => {
    setIsApplying(true);
    await onApply(job.id, job.employerId, message);
    setIsApplying(false);
    setShowApplyForm(false);
    setMessage('');
  };

  return (
    <motion.div 
      layout
      className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all p-6 flex flex-col relative overflow-hidden group"
    >
      {job.aiScore && (
        <div className="absolute top-0 right-0">
          <div className="bg-blue-600 px-3 py-1.5 rounded-bl-xl text-white flex items-center gap-1.5 font-bold text-[11px] shadow-sm">
            <Sparkles size={12} className="text-blue-200" />
            <span>{job.aiScore}% Match</span>
          </div>
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
            <Briefcase className="text-slate-400 group-hover:text-blue-500" size={24} />
          </div>
          <div className="pr-16">
            <div className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider inline-block mb-1">
              {job.industry}
            </div>
            <h3 className="font-bold text-lg text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{job.title}</h3>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{job.location.microdistrict}, Актау</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
            <Clock size={14} className="shrink-0 text-slate-400" />
            <span className="capitalize">{job.jobType.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium">
            <Star size={14} className="shrink-0 text-slate-400" />
            <span className="capitalize">{job.experience.replace('-', ' ')}</span>
          </div>
        </div>

        {job.aiReason && (
          <div className="mb-6 p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700 leading-relaxed font-medium">
            <Sparkles size={10} className="inline mr-1 mb-0.5" /> {job.aiReason}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-6">
          {job.skills.slice(0, 3).map((s: string) => (
            <span key={s} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded-lg">
              {s}
            </span>
          ))}
          {job.skills.length > 3 && (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-400 text-[11px] font-semibold rounded-lg">
              +{job.skills.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="text-lg font-bold text-slate-900 italic">
          {job.salary || 'Договорная'}
        </div>
        <button 
          onClick={() => setShowApplyForm(!showApplyForm)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-sm"
        >
          Откликнуться
        </button>
      </div>

      <AnimatePresence>
        {showApplyForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-slate-100">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">Сопроводительное письмо</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none mb-3"
                placeholder="Расскажите, почему вы подходите на эту роль..."
                rows={3}
              />
              <button 
                onClick={handleApplyClick}
                disabled={isApplying}
                className="w-full py-3 bg-[#00529B] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                {isApplying ? 'Отправка...' : 'Отправить отклик'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
