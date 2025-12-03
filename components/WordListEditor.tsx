import React, { useState } from 'react';
import { WordPair, TranslationOption } from '../types';
import { Trash2, Plus, Languages, Loader2, Check, Save } from 'lucide-react';
import { translateText } from '../services/geminiService';

interface WordListEditorProps {
  words: WordPair[];
  categories: string[];
  onAddWord: (word: WordPair) => void;
  onRemoveWord: (id: string) => void;
  onUpdateWord: (id: string, field: 'english' | 'chinese', value: string) => void;
  onSaveToLibrary: (word: WordPair, category: string) => void;
}

export const WordListEditor: React.FC<WordListEditorProps> = ({ 
  words, 
  categories,
  onAddWord, 
  onRemoveWord, 
  onUpdateWord,
  onSaveToLibrary
}) => {
  const [newEn, setNewEn] = useState('');
  const [newCn, setNewCn] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationOptions, setTranslationOptions] = useState<TranslationOption[]>([]);
  const [targetField, setTargetField] = useState<'english' | 'chinese' | null>(null);
  
  // State for "Save to Library"
  const [saveToLib, setSaveToLib] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Uncategorized');

  const handleAdd = () => {
    if (!newEn.trim() && !newCn.trim()) return;
    
    const newWord: WordPair = {
      id: Date.now().toString(),
      english: newEn.trim(),
      chinese: newCn.trim()
    };

    onAddWord(newWord);

    if (saveToLib) {
      onSaveToLibrary(newWord, selectedCategory);
    }

    // Reset
    setNewEn('');
    setNewCn('');
    setTranslationOptions([]);
    setSaveToLib(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const performTranslation = async (text: string, from: 'en' | 'zh') => {
    if (!text.trim()) return;
    
    setIsTranslating(true);
    setTargetField(from === 'en' ? 'chinese' : 'english');
    
    try {
      const options = await translateText(text, from);
      if (options.length === 1) {
        // Auto-fill if only one confident option
        if (from === 'en') setNewCn(options[0].text);
        else setNewEn(options[0].text);
        setTranslationOptions([]);
      } else {
        setTranslationOptions(options);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Create Dictation List ({words.length})</h3>
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-b border-slate-200 space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
           {/* English Input */}
           <div className="relative">
             <input
                className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="English Word"
                value={newEn}
                onChange={(e) => setNewEn(e.target.value)}
                onBlur={() => { if(newEn && !newCn) performTranslation(newEn, 'en'); }}
                onKeyDown={handleKeyDown}
             />
             <button 
               className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
               onClick={() => performTranslation(newEn, 'en')}
               title="Translate to Chinese"
             >
                {isTranslating && targetField === 'chinese' ? <Loader2 className="animate-spin" size={18} /> : <Languages size={18} />}
             </button>
           </div>

           {/* Chinese Input */}
           <div className="relative">
             <input
                className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="中文 (Chinese)"
                value={newCn}
                onChange={(e) => setNewCn(e.target.value)}
                onBlur={() => { if(newCn && !newEn) performTranslation(newCn, 'zh'); }}
                onKeyDown={handleKeyDown}
             />
             <button 
               className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
               onClick={() => performTranslation(newCn, 'zh')}
               title="Translate to English"
             >
                {isTranslating && targetField === 'english' ? <Loader2 className="animate-spin" size={18} /> : <Languages size={18} />}
             </button>
           </div>
         </div>

         {/* Translation Suggestions */}
         {translationOptions.length > 0 && (
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 animate-in slide-in-from-top-2">
              <p className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wider">Select {targetField === 'english' ? 'English' : 'Chinese'} Translation:</p>
              <div className="flex flex-wrap gap-2">
                {translationOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (targetField === 'english') setNewEn(opt.text);
                      else setNewCn(opt.text);
                      setTranslationOptions([]);
                    }}
                    className="px-3 py-1 bg-white border border-indigo-200 rounded-full text-sm hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <span className="font-medium">{opt.text}</span>
                    <span className="text-xs opacity-60">({opt.context})</span>
                  </button>
                ))}
              </div>
            </div>
         )}

         {/* Add Actions */}
         <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
             <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                <input 
                  type="checkbox" 
                  id="saveToLib"
                  checked={saveToLib}
                  onChange={(e) => setSaveToLib(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="saveToLib" className="text-sm text-slate-600 flex items-center gap-1 select-none cursor-pointer">
                  <Save size={14} /> Save to Library:
                </label>
                <select 
                  disabled={!saveToLib}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-white border border-slate-300 text-sm rounded px-2 py-1 outline-none disabled:opacity-50"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
             </div>

             <button 
              onClick={handleAdd}
              disabled={!newEn && !newCn}
              className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} /> Add Word
            </button>
         </div>
      </div>
      
      {/* List Display */}
      <div className="max-h-[300px] overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {words.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            List is empty. Add words manually or from the library below!
          </div>
        )}
        {words.map((word) => (
          <div key={word.id} className="flex gap-3 items-center group bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
            <input
              className="flex-1 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-2 py-1 text-slate-800 bg-transparent transition-colors"
              value={word.english}
              onChange={(e) => onUpdateWord(word.id, 'english', e.target.value)}
              placeholder="English"
            />
            <div className="w-px h-4 bg-slate-200"></div>
            <input
              className="flex-1 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-2 py-1 text-slate-800 bg-transparent transition-colors"
              value={word.chinese}
              onChange={(e) => onUpdateWord(word.id, 'chinese', e.target.value)}
              placeholder="Chinese"
            />
            <button 
              onClick={() => onRemoveWord(word.id)}
              className="text-slate-300 hover:text-rose-500 p-2 transition-colors"
              aria-label="Remove word"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};