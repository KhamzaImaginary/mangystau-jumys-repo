import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import JobBoard from './components/JobBoard';
import EmployerDashboard from './components/EmployerDashboard';
import SeekerProfile from './components/SeekerProfile';
import { Briefcase, User as UserIcon, LayoutDashboard, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'dashboard' | 'profile'>('board');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // If no profile exists, we'll need to create one (handled in Auth)
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-blue-600 font-bold text-xl"
        >
          JUМYS MANGYSTAU
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // If user is logged in but no profile exists, force profile creation
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <SeekerProfile isInitialSetup 
          userId={user.uid} 
          email={user.email || ''} 
          onComplete={(p) => setProfile(p)} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <JobBoard profile={profile} />
            </motion.div>
          )}
          
          {activeTab === 'dashboard' && profile.role === 'employer' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <EmployerDashboard profile={profile} />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SeekerProfile 
                userId={user.uid} 
                email={user.email || ''} 
                initialProfile={profile}
                onComplete={(p) => setProfile(p)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button 
          onClick={() => setActiveTab('board')}
          className={`flex flex-col items-center ${activeTab === 'board' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <Search size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider font-bold">Search</span>
        </button>
        {profile.role === 'employer' && (
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] mt-1 uppercase tracking-wider font-bold">Manage</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <UserIcon size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}
