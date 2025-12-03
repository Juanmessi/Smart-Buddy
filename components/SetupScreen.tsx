
import React, { useState } from 'react';
import { WordPair, QuizConfig, LanguageMode, WordLibrary, TestRecord, GeneratedPassage, TranslationOption } from '../types';
import { generateWordListFromTopic, generatePassageWithVocab, translateText, generatePassageFromWords } from '../services/geminiService';
import { WordListEditor } from './WordListEditor';
import { Button } from './Button';
import { Wand2, Play, Library, Plus, Trash2, CheckSquare, Square, FolderPlus, Mic, History, BrainCircuit, X, Loader2, BookOpen, MessageCircle } from 'lucide-react';

interface SetupScreenProps {
  initialWords: WordPair[];
  library: WordLibrary;
  testHistory: TestRecord[];
  onStart: (words: WordPair[], config: QuizConfig) => void;
  onStartSpeaking: (initialText?: string) => void;
  onStartDialogue: (topic: string) => void;
  onAddToLibrary: (word: WordPair, category: string) => void;
  onUpdateLibrary: (library: WordLibrary) => void;
  onClearHistory: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ 
  initialWords, 
  library,
  testHistory,
  onStart,
  onStartSpeaking,
  onStartDialogue,
  onAddToLibrary,
  onUpdateLibrary,
  onClearHistory
}) => {
  const [activeWords, setActiveWords] = useState<WordPair[]>(initialWords);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMode, setGenMode] = useState<'list' | 'story' | 'roleplay' | 'words_to_story'>('list');
  const [generatedPassage, setGeneratedPassage] = useState<GeneratedPassage | null>(null);

  const [config, setConfig] = useState<QuizConfig>({
    promptLanguage: LanguageMode.ENGLISH,
    answerLanguage: LanguageMode.ENGLISH,
    randomize: false,
  });

  // Library State
  const categories = Object.keys(library);
  const [activeCategory, setActiveCategory] = useState(categories[1] || categories[0]); 
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Paste Modal State
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Interactive Word State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [translationOptions, setTranslationOptions] = useState<TranslationOption[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleGenerate = async () => {
    if (genMode === 'roleplay') {
       if(topic.trim()) onStartDialogue(topic);
       return;
    }

    // Logic for other modes
    if ((genMode === 'list' || genMode === 'story') && !topic.trim()) return;
    
    setIsGenerating(true);
    setGeneratedPassage(null);

    try {
      if (genMode === 'list') {
        const newWords = await generateWordListFromTopic(topic);
        setActiveWords((prev) => [...prev, ...newWords]);
        setTopic('');
      } else if (genMode === 'story') {
        const passage = await generatePassageWithVocab(topic);
        setGeneratedPassage(passage);
      } else if (genMode === 'words_to_story') {
        const wordsToUse = activeWords.map(w => w.english);
        if(wordsToUse.length === 0) { alert("List is empty"); setIsGenerating(false); return; }
        const passage = await generatePassageFromWords(wordsToUse);
        setGeneratedPassage(passage);
      }
    } catch (error) {
      alert('Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddPassageWord = (word: WordPair) => {
    setActiveWords(prev => [...prev, word]);
  };

  const handleInteractiveWordClick = async (word: string) => {
    // Clean word (remove punctuation)
    const cleanWord = word.replace(/[.,!?"'()]/g, "");
    if (!cleanWord) return;

    setSelectedWord(cleanWord);
    setIsTranslating(true);
    setTranslationOptions([]);

    try {
      const options = await translateText(cleanWord, 'en');
      setTranslationOptions(options);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAddFromPopup = (translation: string) => {
    if (!selectedWord) return;
    const newWord: WordPair = {
      id: Date.now().toString(),
      english: selectedWord,
      chinese: translation
    };
    onAddToLibrary(newWord, activeCategory);
    setActiveWords(prev => [...prev, newWord]);
    setSelectedWord(null); // Close popup
  };

  // SRS Logic: Find words due for review
  const getDueWords = (): WordPair[] => {
    const now = Date.now();
    const allWords = Object.values(library).flat() as WordPair[];
    return allWords.filter(w => {
      if (!w.lastReviewed) return true; // Never reviewed
      const intervalMs = (w.reviewInterval || 0) * 24 * 60 * 60 * 1000;
      return (w.lastReviewed + intervalMs) <= now;
    });
  };

  const handleLoadReview = () => {
    const due = getDueWords();
    if (due.length === 0) {
      alert("Great job! No words are due for review right now.");
    } else {
      // Shuffle 20 due words max
      const selection = due.sort(() => Math.random() - 0.5).slice(0, 20);
      setActiveWords(selection);
      setConfig(prev => ({...prev, randomize: true}));
    }
  };

  const handleAddWord = (word: WordPair) => setActiveWords([...activeWords, word]);
  const handleRemoveWord = (id: string) => setActiveWords(activeWords.filter(w => w.id !== id));
  const handleUpdateWord = (id: string, field: 'english' | 'chinese', value: string) => {
    setActiveWords(activeWords.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || library[newCategoryName]) return;
    onUpdateLibrary({ ...library, [newCategoryName]: [] });
    setActiveCategory(newCategoryName);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === 'Uncategorized' || !window.confirm(`Delete category "${cat}"?`)) return;
    const newLib = { ...library };
    delete newLib[cat];
    onUpdateLibrary(newLib);
    setActiveCategory(Object.keys(newLib)[0]);
  };

  const handleRemoveFromLibrary = (category: string, wordId: string) => {
    const newLib = { ...library };
    newLib[category] = newLib[category].filter(w => w.id !== wordId);
    onUpdateLibrary(newLib);
  };

  const toggleWordInQuiz = (word: WordPair) => {
    const exists = activeWords.find(w => w.english === word.english && w.chinese === word.chinese);
    if (exists) setActiveWords(activeWords.filter(w => w.id !== exists.id));
    else setActiveWords([...activeWords, { ...word, id: Date.now().toString() + Math.random() }]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Smart <span className="text-indigo-600">Dictation</span> Buddy</h1>
           <p className="text-slate-500">AI-powered learning, spaced repetition & speaking practice.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="text-sm px-3">
             <History size={16} /> History
           </Button>
        </div>
      </div>

      {/* History Modal/Panel */}
      {showHistory && (
         <div className="bg-white p-4 rounded-2xl shadow border border-slate-200 animate-in slide-in-from-top-5">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg">Test History</h3>
             <button onClick={onClearHistory} className="text-rose-500 text-xs hover:underline">Clear All</button>
           </div>
           <div className="max-h-60 overflow-y-auto space-y-2">
             {testHistory.length === 0 ? <p className="text-slate-400 text-sm">No tests taken yet.</p> : 
               testHistory.slice().reverse().map(rec => (
                 <div key={rec.id} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                   <span>{new Date(rec.date).toLocaleDateString()}</span>
                   <span className={`font-bold ${rec.score === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                     {rec.score}% ({rec.total - rec.wrongWords.length}/{rec.total})
                   </span>
                 </div>
               ))
             }
           </div>
         </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><BookOpen size={20}/></div>
                  <h3 className="text-xl font-bold text-indigo-900">Smart Reader</h3>
               </div>
               <button onClick={() => setShowPasteModal(false)} className="text-slate-400 hover:text-rose-500"><X size={24}/></button>
             </div>
             <p className="text-slate-500 text-sm mb-4">Paste any article, story, or text below. The AI will read it to you, and you can practice speaking or click words to translate.</p>
             <textarea 
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full h-48 border border-slate-300 rounded-xl p-4 mb-4 outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-lg"
                placeholder="Paste content here..."
                autoFocus
             />
             <div className="flex justify-end gap-3">
               <Button variant="outline" onClick={() => setShowPasteModal(false)}>Cancel</Button>
               <Button 
                  onClick={() => {
                    if(pasteText.trim()) {
                      onStartSpeaking(pasteText);
                      setShowPasteModal(false);
                      setPasteText('');
                    }
                  }} 
                  disabled={!pasteText.trim()}
                >
                 Start Reading <Play size={18}/>
               </Button>
             </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left: Generation & Editor */}
        <div className="lg:col-span-7 space-y-6">
           {/* AI Generator */}
           <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Wand2 className="text-yellow-300" /> <h2 className="font-bold text-lg">AI Generator</h2></div>
                </div>
                
                {/* Gen Mode Tabs */}
                <div className="flex flex-wrap gap-2 mb-4 bg-indigo-800/40 p-1.5 rounded-xl">
                   <button onClick={() => setGenMode('list')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genMode === 'list' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:text-white'}`}>Vocabulary</button>
                   <button onClick={() => setGenMode('story')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genMode === 'story' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:text-white'}`}>Story</button>
                   <button onClick={() => setGenMode('words_to_story')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genMode === 'words_to_story' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:text-white'}`}>Use List</button>
                   <button onClick={() => setGenMode('roleplay')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genMode === 'roleplay' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:text-white'}`}>Roleplay</button>
                </div>

                <div className="flex gap-2">
                   {genMode !== 'words_to_story' ? (
                     <input 
                       value={topic}
                       onChange={(e) => setTopic(e.target.value)}
                       placeholder={genMode === 'roleplay' ? "Roleplay Scenario (e.g. At a Cafe)" : "Topic (e.g. Space Travel)"}
                       className="flex-1 px-4 py-3 rounded-xl text-slate-800 focus:ring-4 focus:ring-indigo-400/50 outline-none border-0"
                       onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                     />
                   ) : (
                     <div className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-indigo-100 italic text-sm">
                        Generates a story using your current vocabulary list below ({activeWords.length} words).
                     </div>
                   )}
                  <Button onClick={handleGenerate} isLoading={isGenerating} variant="secondary" className="whitespace-nowrap text-sm py-2">
                    {genMode === 'roleplay' ? 'Start Chat' : 'Generate'}
                  </Button>
                </div>
            </div>
          </div>

          {/* Generated Passage View */}
          {generatedPassage && (
            <div className="bg-white rounded-2xl p-6 border-2 border-purple-100 shadow-sm animate-in fade-in relative">
               <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-purple-900">{generatedPassage.title}</h3>
                  <div className="flex gap-2">
                     <button 
                        onClick={() => onStartSpeaking(generatedPassage?.content)} 
                        className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold hover:bg-indigo-100 flex items-center gap-1"
                     >
                        <BookOpen size={14}/> Read & Practice
                     </button>
                     <button onClick={() => setGeneratedPassage(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
               </div>
               
               {/* Clickable Story Content */}
               <div className="text-slate-700 leading-relaxed mb-4 text-lg border-b border-slate-100 pb-4">
                 {generatedPassage.content.split(' ').map((word, idx) => (
                   <span 
                    key={idx} 
                    onClick={() => handleInteractiveWordClick(word)}
                    className="cursor-pointer hover:bg-indigo-100 hover:text-indigo-700 rounded px-0.5 transition-colors"
                   >
                    {word}{' '}
                   </span>
                 ))}
               </div>

               {/* Translation Popup Overlay */}
               {selectedWord && (
                 <div className="absolute top-20 left-0 right-0 mx-4 bg-white shadow-2xl border border-indigo-100 rounded-xl p-4 animate-in zoom-in-95 z-20">
                   <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-xl text-indigo-900">{selectedWord}</h4>
                      <button onClick={() => setSelectedWord(null)} className="text-slate-400"><X size={16}/></button>
                   </div>
                   {isTranslating ? (
                     <div className="flex items-center gap-2 text-slate-500 py-4"><Loader2 className="animate-spin"/> Translating...</div>
                   ) : (
                     <div className="space-y-2">
                       {translationOptions.map((opt, idx) => (
                         <button 
                          key={idx} 
                          onClick={() => handleAddFromPopup(opt.text)}
                          className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg flex justify-between items-center group"
                         >
                           <span>{opt.text} <span className="text-slate-400 text-sm">({opt.context})</span></span>
                           <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100">Add to Library ({activeCategory})</span>
                         </button>
                       ))}
                       {translationOptions.length === 0 && <p className="text-slate-400">No translations found.</p>}
                     </div>
                   )}
                 </div>
               )}

               {generatedPassage.vocabulary.length > 0 && (
                 <>
                   <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">Extracted Vocabulary</h4>
                   <div className="flex flex-wrap gap-2">
                    {generatedPassage.vocabulary.map(word => {
                      const added = activeWords.some(w => w.english === word.english);
                      return (
                        <button 
                            key={word.id}
                            disabled={added}
                            onClick={() => handleAddPassageWord(word)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${added ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200 hover:border-purple-300'}`}
                        >
                            {word.english} {added && <span className="ml-1">✓</span>}
                        </button>
                      )
                    })}
                   </div>
                 </>
               )}
            </div>
          )}

          <WordListEditor 
            words={activeWords} 
            categories={categories}
            onAddWord={handleAddWord}
            onRemoveWord={handleRemoveWord}
            onUpdateWord={handleUpdateWord}
            onSaveToLibrary={onAddToLibrary}
          />
        </div>

        {/* Right: Library & Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Actions */}
          <div className="grid gap-3">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Voice</span>
                      <button onClick={() => setConfig({...config, promptLanguage: config.promptLanguage === LanguageMode.ENGLISH ? LanguageMode.CHINESE : LanguageMode.ENGLISH})} className="font-bold text-indigo-600 text-sm">{config.promptLanguage}</button>
                   </div>
                   <div className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Answer</span>
                      <button onClick={() => setConfig({...config, answerLanguage: config.answerLanguage === LanguageMode.ENGLISH ? LanguageMode.CHINESE : LanguageMode.ENGLISH})} className="font-bold text-indigo-600 text-sm">{config.answerLanguage}</button>
                   </div>
                 </div>
                 
                 <Button variant="primary" className="w-full" disabled={activeWords.length === 0} onClick={() => onStart(activeWords, config)}>
                    <Play fill="currentColor" size={18} /> Start Dictation
                 </Button>
                 
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => onStartSpeaking()} className="text-sm px-2">
                       <Mic size={16} /> Speaking
                    </Button>
                    <Button variant="outline" onClick={() => setShowPasteModal(true)} className="text-sm px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200">
                       <BookOpen size={16} /> Reader
                    </Button>
                 </div>
                 <Button variant="outline" onClick={handleLoadReview} className="w-full text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200">
                    <BrainCircuit size={16} /> Review Due
                 </Button>
              </div>
          </div>

          {/* Library Browser */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[450px]">
             <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-slate-700"><Library size={18} /> Word Bank</div>
                <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><FolderPlus size={18} /></button>
             </div>

             <div className="flex overflow-x-auto p-2 bg-slate-50 gap-2 border-b border-slate-200 no-scrollbar">
                {isAddingCategory && (
                  <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded px-2 py-1 min-w-[100px]">
                     <input autoFocus className="w-full text-xs outline-none" placeholder="Name..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
                     <button onClick={handleAddCategory}><Plus size={12} className="text-indigo-600"/></button>
                  </div>
                )}
                {categories.map(cat => (
                   <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{cat}</button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex justify-between items-center px-2 py-1 mb-1">
                   <span className="text-[10px] font-bold text-slate-400 uppercase">{activeCategory} ({library[activeCategory]?.length || 0})</span>
                   {activeCategory !== 'Uncategorized' && <button onClick={() => handleDeleteCategory(activeCategory)} className="text-rose-400 hover:text-rose-600"><Trash2 size={12} /></button>}
                </div>
                {library[activeCategory]?.length === 0 ? <div className="text-center py-8 text-slate-400 text-xs">Empty category.</div> : 
                   library[activeCategory]?.map(word => {
                      const active = activeWords.some(w => w.id === word.id || (w.english === word.english && w.chinese === word.chinese));
                      return (
                        <div key={word.id} className="group flex items-center gap-3 p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                           <button onClick={() => toggleWordInQuiz(word)} className="text-indigo-600">{active ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}</button>
                           <div className="flex-1 leading-tight">
                              <div className="text-sm font-bold text-slate-700">{word.english}</div>
                              <div className="text-xs text-slate-500">{word.chinese}</div>
                           </div>
                           {word.lastReviewed && <div className="text-[10px] text-orange-400 font-bold bg-orange-50 px-1 rounded">SRS</div>}
                           <button onClick={() => handleRemoveFromLibrary(activeCategory, word.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                        </div>
                      );
                   })
                }
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
