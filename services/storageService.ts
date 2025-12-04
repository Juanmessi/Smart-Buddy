
import { User, WordLibrary, TestRecord, WordPair } from '../types';

const USERS_KEY = 'sdb_users';
const CURRENT_USER_KEY = 'sdb_current_user';
const ADMIN_IDENTIFIERS = ['910272860@qq.com', '13585556661'];

const getUserKey = (userId: string) => `sdb_data_${userId}`;

const DEFAULT_LIBRARY: WordLibrary = {
  'Food': [
    { id: 'def-1', english: 'Apple', chinese: '苹果', category: 'Food' },
    { id: 'def-2', english: 'Banana', chinese: '香蕉', category: 'Food' },
    { id: 'def-3', english: 'Bread', chinese: '面包', category: 'Food' },
    { id: 'def-4', english: 'Milk', chinese: '牛奶', category: 'Food' },
    { id: 'def-5', english: 'Coffee', chinese: '咖啡', category: 'Food' },
  ],
  'Animals': [
    { id: 'def-6', english: 'Cat', chinese: '猫', category: 'Animals' },
    { id: 'def-7', english: 'Dog', chinese: '狗', category: 'Animals' },
    { id: 'def-8', english: 'Elephant', chinese: '大象', category: 'Animals' },
    { id: 'def-9', english: 'Tiger', chinese: '老虎', category: 'Animals' },
  ],
  'School': [
    { id: 'def-10', english: 'Book', chinese: '书', category: 'School' },
    { id: 'def-11', english: 'Teacher', chinese: '老师', category: 'School' },
    { id: 'def-12', english: 'Student', chinese: '学生', category: 'School' },
    { id: 'def-13', english: 'Pencil', chinese: '铅笔', category: 'School' },
  ],
  'Travel': [
     { id: 'def-14', english: 'Airport', chinese: '机场', category: 'Travel' },
     { id: 'def-15', english: 'Ticket', chinese: '票', category: 'Travel' },
     { id: 'def-16', english: 'Hotel', chinese: '酒店', category: 'Travel' },
  ],
  'Uncategorized': []
};

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

    // Initialize User Data with Defaults immediately
    StorageService.saveUserData(newUser.id, { 
        library: DEFAULT_LIBRARY, 
        history: [] 
    });

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
