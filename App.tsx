
import React, { useState, useEffect } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { QuizScreen } from './components/QuizScreen';
import { ResultScreen } from './components/ResultScreen';
import { SpeakingPracticeScreen } from './components/SpeakingPracticeScreen';
import { DialogueScreen } from './components/DialogueScreen';
import { AppMode, WordPair, QuizConfig, QuizResult, WordLibrary, TestRecord } from './types';

// Default placeholder words
const DEFAULT_WORDS: WordPair[] = [
  { id: '1', english: 'Apple', chinese: '苹果', category: 'Food' },
  { id: '2', english: 'Bicycle', chinese: '自行车', category: 'Transport' },
  { id: '3', english: 'Library', chinese: '图书馆', category: 'Places' },
];

// Initial Library Data
const INITIAL_LIBRARY: WordLibrary = {
  'Uncategorized': [],
  'Food': [
    { id: 'l1', english: 'Apple', chinese: '苹果', category: 'Food' },
    { id: 'l2', english: 'Banana', chinese: '香蕉', category: 'Food' },
    { id: 'l3', english: 'Bread', chinese: '面包', category: 'Food' },
  ],
  'Animals': [
    { id: 'l4', english: 'Cat', chinese: '猫', category: 'Animals' },
    { id: 'l5', english: 'Dog', chinese: '狗', category: 'Animals' },
  ],
  'School': [
    { id: 'l6', english: 'Pencil', chinese: '铅笔', category: 'School' },
    { id: 'l7', english: 'Teacher', chinese: '老师', category: 'School' },
  ]
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SETUP);
  const [activeWords, setActiveWords] = useState<WordPair[]>(DEFAULT_WORDS);
  const [library, setLibrary] = useState<WordLibrary>(INITIAL_LIBRARY);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [lastResults, setLastResults] = useState<QuizResult[]>([]);
  
  // State to pass text to speaking mode
  const [speakingInitialText, setSpeakingInitialText] = useState<string | undefined>(undefined);
  const [dialogueTopic, setDialogueTopic] = useState<string>('');

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
      if (existingList.some(w => w.english.toLowerCase() === word.english.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [targetCategory]: [...existingList, { ...word, category: targetCategory }]
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer" onClick={handleHome}>
            <span className="bg-indigo-600 text-white rounded-lg p-1.5">SD</span>
            <span className="hidden sm:inline">Smart Dictation</span>
          </div>
          {mode !== AppMode.SETUP && (
             <button onClick={handleHome} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                Exit / Home
             </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {mode === AppMode.SETUP && (
          <SetupScreen 
            initialWords={activeWords} 
            library={library}
            testHistory={testHistory}
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
      </main>
    </div>
  );
};

export default App;
