
import React, { useState } from 'react';
import { User, DailyContent } from '../types';
import { StorageService } from '../services/storageService';
import { Button } from './Button';
import { User as UserIcon, Lock, LogIn, UserPlus, AlertCircle, Quote } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  dailyContent: DailyContent | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, dailyContent }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    // Simulate network delay for UX
    await new Promise(r => setTimeout(r, 600));

    try {
      let user: User;
      if (isLogin) {
        user = StorageService.login(username, password);
      } else {
        user = StorageService.register(username, password);
      }
      StorageService.saveSession(user);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-5xl w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row">
        
        {/* Left Side: Daily Inspirations */}
        <div className="bg-indigo-600 p-10 md:w-1/2 flex flex-col justify-center text-white relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <Quote size={300} className="absolute -top-10 -left-10" />
           </div>
           
           <div className="relative z-10">
              <h2 className="text-3xl font-extrabold mb-6 flex items-center gap-3">
                 Daily Inspiration
              </h2>
              {dailyContent ? (
                <div className="space-y-6">
                   {dailyContent.quotes.map((q, idx) => (
                      <div key={idx} className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                         <p className="text-lg font-serif italic mb-2">"{q.english}"</p>
                         <p className="text-sm opacity-90 mb-2">{q.chinese}</p>
                         <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">— {q.author}</p>
                      </div>
                   ))}
                   <p className="text-xs text-indigo-300 mt-4">New content generated daily by AI</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-indigo-200">
                   <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                   Loading today's quotes...
                </div>
              )}
           </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-10 md:w-1/2 flex flex-col justify-center bg-white">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-indigo-900 mb-2">Smart Dictation</h1>
            <p className="text-slate-500">Welcome back! Please login to continue.</p>
          </div>

          <div className="flex gap-4 mb-8 bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => { setIsLogin(true); setError(''); }}
               className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Login
             </button>
             <button 
               onClick={() => { setIsLogin(false); setError(''); }}
               className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Register
             </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username / Phone / Email</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. 13585556661"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Set your password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-50 p-3 rounded-lg">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full mt-2" 
              isLoading={isLoading}
            >
              {isLogin ? <><LogIn size={20}/> Login</> : <><UserPlus size={20}/> Create Account</>}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400">
             Admin access available for authorized accounts.
          </div>
        </div>
      </div>
    </div>
  );
};
