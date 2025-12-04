
import React, { useState, useEffect } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { QuizScreen } from './components/QuizScreen';
import { ResultScreen } from './components/ResultScreen';
import { SpeakingPracticeScreen } from './components/SpeakingPracticeScreen';
import { DialogueScreen } from './components/DialogueScreen';
import { AuthScreen } from './components/AuthScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AppMode, WordPair, QuizConfig, QuizResult, WordLibrary, TestRecord, User, DailyContent } from './types';
import { StorageService } from './services/storageService';
import { generateDailyContent } from './services/geminiService';
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.SETUP);
  const [activeWords, setActiveWords] = useState<WordPair[]>([]);
  
  const [library, setLibrary] = useState<WordLibrary>({});
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [lastResults, setLastResults] = useState<QuizResult[]>([]);
  
  // State to pass text to speaking mode
  const [speakingInitialText, setSpeakingInitialText] = useState<string | undefined>(undefined);
  const [dialogueTopic, setDialogueTopic] = useState<string>('');

  // Daily Content
  const [dailyContent, setDailyContent] = useState<DailyContent | null>(null);

  // 1. Check for valid session on mount and Load Daily Content
  useEffect(() => {
    const session = StorageService.getSession();
    if (session) {
      handleLogin(session);
    }
    loadDailyContent();
  }, []);

  const loadDailyContent = async () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('sdb_daily_content');
    
    if (stored) {
      const parsed: DailyContent = JSON.parse(stored);
      if (parsed.date === today) {
        setDailyContent(parsed);
        return;
      }
    }

    // Generate new if missing or old
    try {
      const content = await generateDailyContent(today);
      if (content) {
        setDailyContent(content);
        localStorage.setItem('sdb_daily_content', JSON.stringify(content));
      }
    } catch (e) {
      console.error("Failed to load daily content", e);
    }
  };

  // 2. Load User Data when User changes
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    const data = StorageService.loadUserData(loggedInUser.id);
    if (data) {
      setLibrary(data.library);
      setTestHistory(data.history);
      
      // Auto-populate active words with a few items from the library to prevent empty screen
      const allWords = Object.values(data.library).flat();
      const sample = allWords.slice(0, 5);
      setActiveWords(sample.length > 0 ? sample : []);
    } else {
      // Should ideally not happen for new users as StorageService.register handles initialization
      setLibrary({'Uncategorized': []});
      setTestHistory([]);
      setActiveWords([]);
    }
    setMode(AppMode.SETUP);
  };

  const handleLogout = () => {
    StorageService.clearSession();
    setUser(null);
    setLibrary({}); 
    setTestHistory([]);
    setActiveWords([]);
  };

  // 3. Persist Data whenever Library or History changes
  useEffect(() => {
    if (user) {
      StorageService.saveUserData(user.id, { library, history: testHistory });
    }
  }, [library, testHistory, user]);

  const handleStartQuiz = (words: WordPair[], config: QuizConfig) => {
    setActiveWords(words);
    setQuizConfig(config);
    setMode(AppMode.QUIZ);
  };

  const handleStartSpeaking = (text?: string) => {
    setSpeakingInitialText(text);
    setMode(AppMode.SPEAKING);
  };

  const handleStartDialogue = (topic: string) => {
    setDialogueTopic(topic);
    setMode(AppMode.DIALOGUE);
  };

  const handleQuizComplete = (results: QuizResult[]) => {
    setLastResults(results);
    
    // Update SRS Logic in Library
    const now = Date.now();
    const wrongWords: {english: string, chinese: string}[] = [];
    let correctCount = 0;

    setLibrary(prevLibrary => {
      const newLibrary = { ...prevLibrary };
      
      results.forEach(res => {
        if (res.isCorrect) correctCount++;
        else wrongWords.push({ english: res.correctAnswer, chinese: res.userAnswer || 'Empty' });

        // Find word in library to update stats
        for (const cat in newLibrary) {
          const idx = newLibrary[cat].findIndex(w => w.id === res.wordId);
          if (idx !== -1) {
             const word = newLibrary[cat][idx];
             // SRS Algorithm (Simplified)
             const currentInterval = word.reviewInterval || 0;
             const newInterval = res.isCorrect 
                ? (currentInterval === 0 ? 1 : currentInterval * 2) // Exponential backoff
                : 0; // Reset on failure
             
             newLibrary[cat][idx] = {
               ...word,
               lastReviewed: now,
               reviewInterval: newInterval,
               proficiency: res.isCorrect ? Math.min((word.proficiency || 0) + 1, 5) : Math.max((word.proficiency || 0) - 1, 0)
             };
          }
        }
      });
      return newLibrary;
    });

    // Save Record
    const record: TestRecord = {
      id: Date.now().toString(),
      date: now,
      score: Math.round((correctCount / results.length) * 100),
      total: results.length,
      wrongWords
    };
    setTestHistory(prev => [...prev, record]);

    setMode(AppMode.RESULT);
  };

  const handleRestart = () => {
    setMode(AppMode.QUIZ);
  };

  const handleHome = () => {
    setMode(AppMode.SETUP);
    setSpeakingInitialText(undefined);
  };

  // Helper to add a word to the library
  const handleAddToLibrary = (word: WordPair, category: string) => {
    setLibrary(prev => {
      const targetCategory = category || 'Uncategorized';
      const existingList = prev[targetCategory] || [];
      // Prevent duplicates by English text
      if (existingList.some(w => w.english.toLowerCase() === word.english.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [targetCategory]: [...existingList, { ...word, category: targetCategory }]
      };
    });
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} dailyContent={dailyContent} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer" onClick={handleHome}>
            <span className="bg-indigo-600 text-white rounded-lg p-1.5">SD</span>
            <span className="hidden sm:inline">Smart Dictation</span>
          </div>
          
          <div className="flex items-center gap-4">
             {user && (
               <div className="hidden sm:flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                 <UserIcon size={16} />
                 <span className="text-sm font-bold text-slate-700">{user.username}</span>
               </div>
             )}

             {user.isAdmin && (
               <button 
                  onClick={() => setMode(AppMode.ADMIN)}
                  className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold border border-indigo-200 shadow-sm"
               >
                 <ShieldCheck size={16} /> Admin Panel
               </button>
             )}
             
             {mode !== AppMode.SETUP && (
               <button onClick={handleHome} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                  Exit
               </button>
             )}

             <button 
                onClick={handleLogout} 
                className="flex items-center gap-1 text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold"
                title="Logout"
             >
                <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {mode === AppMode.SETUP && (
          <SetupScreen 
            initialWords={activeWords} 
            library={library}
            testHistory={testHistory}
            dailyContent={dailyContent}
            onStart={handleStartQuiz}
            onStartSpeaking={handleStartSpeaking}
            onStartDialogue={handleStartDialogue}
            onAddToLibrary={handleAddToLibrary}
            onUpdateLibrary={setLibrary}
            onClearHistory={() => setTestHistory([])}
          />
        )}

        {mode === AppMode.QUIZ && quizConfig && (
          <QuizScreen 
            words={activeWords} 
            config={quizConfig}
            onComplete={handleQuizComplete}
            onCancel={handleHome}
          />
        )}

        {mode === AppMode.RESULT && (
          <ResultScreen 
            results={lastResults} 
            onRestart={handleRestart} 
            onHome={handleHome} 
          />
        )}

        {mode === AppMode.SPEAKING && (
          <SpeakingPracticeScreen 
            initialText={speakingInitialText}
            onBack={handleHome} 
            categories={Object.keys(library)}
            onAddToLibrary={handleAddToLibrary}
          />
        )}

        {mode === AppMode.DIALOGUE && (
          <DialogueScreen
            topic={dialogueTopic}
            onBack={handleHome}
            categories={Object.keys(library)}
            onAddToLibrary={handleAddToLibrary}
          />
        )}

        {mode === AppMode.ADMIN && user.isAdmin && (
          <AdminDashboard 
            currentUser={user}
            onBack={handleHome}
          />
        )}
      </main>
    </div>
  );
};

export default App;
