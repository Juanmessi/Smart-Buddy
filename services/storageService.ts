
import { User, WordLibrary, TestRecord } from '../types';

const USERS_KEY = 'sdb_users';
const CURRENT_USER_KEY = 'sdb_current_user';
const ADMIN_IDENTIFIERS = ['910272860@qq.com', '13585556661'];

const getUserKey = (userId: string) => `sdb_data_${userId}`;

export const StorageService = {
  getUsers: (): User[] => {
    try {
      const users = localStorage.getItem(USERS_KEY);
      return users ? JSON.parse(users) : [];
    } catch { return []; }
  },

  register: (username: string, password?: string): User => {
    const users = StorageService.getUsers();
    const cleanUsername = username.trim();
    
    if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('Username already exists');
    }
    
    const isAdmin = ADMIN_IDENTIFIERS.includes(cleanUsername);

    const newUser: User = {
      id: Date.now().toString(),
      username: cleanUsername,
      password,
      createdAt: Date.now(),
      isAdmin
    };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser;
  },

  login: (username: string, password?: string): User => {
    const users = StorageService.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) throw new Error('User not found');
    if (user.password && user.password !== password) throw new Error('Invalid password');
    return user;
  },
  
  saveSession: (user: User) => {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  },

  getSession: (): User | null => {
    try {
      const u = localStorage.getItem(CURRENT_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },

  clearSession: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  // Save specific user data
  saveUserData: (userId: string, data: { library: WordLibrary, history: TestRecord[] }) => {
    localStorage.setItem(getUserKey(userId), JSON.stringify(data));
  },

  // Load specific user data
  loadUserData: (userId: string): { library: WordLibrary, history: TestRecord[] } | null => {
    try {
      const data = localStorage.getItem(getUserKey(userId));
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  // --- Admin Functions ---

  deleteUser: (targetUserId: string) => {
    let users = StorageService.getUsers();
    users = users.filter(u => u.id !== targetUserId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.removeItem(getUserKey(targetUserId)); // Clear their data
  },

  resetUserPassword: (targetUserId: string, newPass: string) => {
    const users = StorageService.getUsers();
    const idx = users.findIndex(u => u.id === targetUserId);
    if (idx !== -1) {
      users[idx].password = newPass;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
};