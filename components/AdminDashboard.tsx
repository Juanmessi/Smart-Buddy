
import React, { useState, useEffect } from 'react';
import { User, WordLibrary, TestRecord } from '../types';
import { StorageService } from '../services/storageService';
import { Button } from './Button';
import { Trash2, KeyRound, Shield, Search, ArrowLeft } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  onBack: () => void;
}

interface UserStat {
  user: User;
  wordCount: number;
  testCount: number;
  lastActive: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onBack }) => {
  const [users, setUsers] = useState<UserStat[]>([]);
  const [search, setSearch] = useState('');

  const loadUsers = () => {
    const rawUsers = StorageService.getUsers();
    const stats: UserStat[] = rawUsers.map(u => {
      const data = StorageService.loadUserData(u.id);
      const totalWords = data ? Object.values(data.library).reduce((acc, arr) => acc + arr.length, 0) : 0;
      const totalTests = data ? data.history.length : 0;
      const lastTest = data?.history[data.history.length - 1]?.date;
      
      return {
        user: u,
        wordCount: totalWords,
        testCount: totalTests,
        lastActive: lastTest ? new Date(lastTest).toLocaleDateString() : 'Never'
      };
    });
    setUsers(stats);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = (targetUserId: string) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      StorageService.deleteUser(targetUserId);
      loadUsers();
    }
  };

  const handleResetPassword = (targetUserId: string) => {
    const newPass = prompt("Enter new password for this user:");
    if (newPass) {
      StorageService.resetUserPassword(targetUserId, newPass);
      alert("Password updated.");
    }
  };

  const filteredUsers = users.filter(u => u.user.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
         <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
           <ArrowLeft />
         </button>
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Shield className="text-indigo-600"/> Admin Dashboard
            </h2>
            <p className="text-slate-500 text-sm">Manage registered users and view statistics</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">All Users ({users.length})</h3>
            <div className="relative">
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username..."
                className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                  <tr>
                     <th className="px-6 py-3">Username</th>
                     <th className="px-6 py-3">Joined</th>
                     <th className="px-6 py-3">Words</th>
                     <th className="px-6 py-3">Tests Taken</th>
                     <th className="px-6 py-3">Last Active</th>
                     <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(({user, wordCount, testCount, lastActive}) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
                          {user.username}
                          {user.isAdmin && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                          {user.id === currentUser.id && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">YOU</span>}
                       </td>
                       <td className="px-6 py-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                       <td className="px-6 py-4 text-slate-500">{wordCount}</td>
                       <td className="px-6 py-4 text-slate-500">{testCount}</td>
                       <td className="px-6 py-4 text-slate-500">{lastActive}</td>
                       <td className="px-6 py-4 text-right space-x-2">
                          {user.id !== currentUser.id && (
                             <>
                                <button 
                                  onClick={() => handleResetPassword(user.id)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                                  title="Reset Password"
                                >
                                  <KeyRound size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(user.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Delete User"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </>
                          )}
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
            {filteredUsers.length === 0 && (
               <div className="text-center py-10 text-slate-400">No users found.</div>
            )}
         </div>
      </div>
    </div>
  );
};