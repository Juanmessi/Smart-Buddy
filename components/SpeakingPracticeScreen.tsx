import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Mic, Square, Volume2, ArrowLeft, Wand2, PlayCircle, Download, Settings2, X, Loader2, PauseCircle, BookOpen } from 'lucide-react';
import { generatePassageWithVocab, generateSpeechAudio, evaluatePronunciation, translateText } from '../services/geminiService';
import { playPcmAudio, downloadBase64Audio } from '../utils/audioUtils';
import { AudioRecorder } from '../utils/audioRecorder';
import { SpeakingEvaluation, WordPair, TranslationOption } from '../types';

interface SpeakingPracticeScreenProps {
  onBack: () => void;
  categories: string[];
  onAddToLibrary: (word: WordPair, category: string) => void;
  initialText?: string;
}

export const SpeakingPracticeScreen: React.FC<SpeakingPracticeScreenProps> = ({ onBack, categories, onAddToLibrary, initialText }) => {
  const [mode, setMode] = useState<'input' | 'practice'>('input');
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // New Features
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [currentAudioBase64, setCurrentAudioBase64] = useState<string | null>(null);
  const [isDownloadingFull, setIsDownloadingFull] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  // Interactive Text State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [translationOptions, setTranslationOptions] = useState<TranslationOption[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Uncategorized');

  const recorder = useRef<AudioRecorder>(new AudioRecorder());
  const autoPlayRef = useRef<boolean>(false);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      startPractice(initialText);
    }
  }, [initialText]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    try {
      const passage = await generatePassageWithVocab(topic);
      if (passage) {
        setText(passage.content);
        startPractice(passage.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const startPractice = (rawText: string) => {
    // Split text into sentences roughly
    const split = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
    setSentences(split.map(s => s.trim()));
    setCurrentIndex(0);
    setMode('practice');
    setEvaluation(null);
    setCurrentAudioBase64(null);
  };

  // --- Audio Logic ---

  const generateAndCacheAudio = async (idx: number): Promise<string> => {
    const audio = await generateSpeechAudio(sentences[idx], true);
    setCurrentAudioBase64(audio);
    return audio;
  };

  const playCurrentSentence = async () => {
    setIsPlaying(true);
    try {
      const audio = await generateAndCacheAudio(currentIndex);
      await playPcmAudio(audio, 24000, playbackSpeed);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlaying(false);
      
      // Auto-Play Logic
      if (autoPlayRef.current && currentIndex < sentences.length - 1) {
         setTimeout(() => {
           if (autoPlayRef.current) {
             setCurrentIndex(prev => prev + 1);
           }
         }, 500);
      } else if (autoPlayRef.current && currentIndex === sentences.length - 1) {
         autoPlayRef.current = false;
         setIsAutoPlaying(false);
      }
    }
  };

  // Watch for index change to continue auto-play
  useEffect(() => {
    if (isAutoPlaying && mode === 'practice') {
      playCurrentSentence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isAutoPlaying]);

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
    } else {
      setIsAutoPlaying(true);
      autoPlayRef.current = true;
      if (!isPlaying) {
         if (currentIndex === sentences.length - 1) setCurrentIndex(0);
         else playCurrentSentence();
      }
    }
  };

  const handleDownloadSentence = async () => {
    setShowDownloadMenu(false);
    if (currentAudioBase64) {
      downloadBase64Audio(currentAudioBase64, `sentence-${currentIndex + 1}.wav`);
    } else {
      try {
        const audio = await generateAndCacheAudio(currentIndex);
        downloadBase64Audio(audio, `sentence-${currentIndex + 1}.wav`);
      } catch(e) {
        alert("Could not generate audio for download.");
      }
    }
  };

  const handleDownloadFull = async () => {
    setShowDownloadMenu(false);
    setIsDownloadingFull(true);
    try {
       // Re-join text for full audio reading
       const fullText = sentences.join(' ');
       // Note: Gemini might truncate if text is extremely long, but standard articles are fine.
       const audio = await generateSpeechAudio(fullText, true);
       downloadBase64Audio(audio, `full-reading.wav`);
    } catch (e) {
      console.error(e);
      alert("Failed to generate full audio.");
    } finally {
      setIsDownloadingFull(false);
    }
  };

  // --- Word Selection Logic ---

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,!?"'()]/g, "").trim();
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

  const handleSaveWord = (translation: string) => {
    if (!selectedWord) return;
    onAddToLibrary({
      id: Date.now().toString(),
      english: selectedWord,
      chinese: translation
    }, selectedCategory);
    setSelectedWord(null);
  };

  // --- Recording ---

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsEvaluating(true);
      try {
        const base64 = await recorder.current.stop();
        const result = await evaluatePronunciation(base64, sentences[currentIndex]);
        setEvaluation(result);
      } catch (e) {
        console.error(e);
        alert("Error processing audio");
      } finally {
        setIsEvaluating(false);
      }
    } else {
      setEvaluation(null);
      await recorder.current.start();
      setIsRecording(true);
    }
  };

  const nextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setEvaluation(null);
      setIsAutoPlaying(false); autoPlayRef.current = false;
    }
  };

  const prevSentence = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setEvaluation(null);
      setIsAutoPlaying(false); autoPlayRef.current = false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="mb-6 flex items-center gap-4">
         <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
           <ArrowLeft />
         </button>
         <h2 className="text-2xl font-bold text-slate-800">AI Reader & Speaking</h2>
      </div>

      {mode === 'input' ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6">
           <div className="space-y-2">
             <label className="font-bold text-slate-700">Generate Content</label>
             <div className="flex gap-2">
               <input 
                 value={topic}
                 onChange={e => setTopic(e.target.value)}
                 className="flex-1 border border-slate-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                 placeholder="Topic (e.g. A trip to the zoo)"
               />
               <Button onClick={handleGenerate} isLoading={isGenerating} variant="secondary">
                 <Wand2 size={18} /> Generate
               </Button>
             </div>
           </div>

           <div className="relative">
             <div className="absolute inset-0 flex items-center">
               <div className="w-full border-t border-slate-200"></div>
             </div>
             <div className="relative flex justify-center text-sm">
               <span className="px-2 bg-white text-slate-500">OR Paste Text</span>
             </div>
           </div>

           <textarea 
             value={text}
             onChange={e => setText(e.target.value)}
             className="w-full h-60 border border-slate-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
             placeholder="Paste your article, dialogue, or story here..."
           />
           
           <Button className="w-full" onClick={() => startPractice(text)} disabled={!text.trim()}>
             <BookOpen size={18}/> Start Reading Mode
           </Button>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center relative">
           
           {/* Top Controls */}
           <div className="w-full flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                 <button onClick={() => setMode('input')} className="text-sm font-bold text-slate-500 hover:text-indigo-600">Change Text</button>
                 <span className="text-slate-300">|</span>
                 <span className="text-xs text-slate-400 font-bold uppercase">{currentIndex + 1} / {sentences.length}</span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Speed Control */}
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                   <Settings2 size={14} className="text-slate-400" />
                   <input 
                     type="range" 
                     min="0.5" 
                     max="1.5" 
                     step="0.1" 
                     value={playbackSpeed} 
                     onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                     className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                   />
                   <span className="text-xs font-mono w-8">{playbackSpeed}x</span>
                </div>

                {/* Auto Play */}
                <button 
                   onClick={toggleAutoPlay}
                   className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isAutoPlaying ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50'}`}
                >
                   {isAutoPlaying ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                   {isAutoPlaying ? 'Stop Auto' : 'Auto Read'}
                </button>

                {/* Download Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded relative"
                    title="Download audio"
                    disabled={isDownloadingFull}
                  >
                    {isDownloadingFull ? <Loader2 size={18} className="animate-spin"/> : <Download size={18} />}
                  </button>
                  
                  {showDownloadMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <button onClick={handleDownloadSentence} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 block">Current Sentence</button>
                       <button onClick={handleDownloadFull} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-indigo-600 font-bold block border-t border-slate-100">Download Full Text</button>
                    </div>
                  )}
                </div>
              </div>
           </div>

           {/* Text Display - Interactive */}
           <div className="mb-10 w-full text-left bg-slate-50 p-6 rounded-xl border border-slate-100 leading-relaxed text-lg text-slate-600 max-h-[300px] overflow-y-auto">
              {sentences.map((sentence, sIdx) => (
                <span 
                  key={sIdx}
                  className={`mr-1 rounded transition-all duration-300 ${sIdx === currentIndex ? 'bg-indigo-100 shadow-sm ring-2 ring-indigo-100' : 'opacity-60 hover:opacity-100'}`}
                >
                  {sentence.split(' ').map((word, wIdx) => (
                     <span 
                        key={wIdx}
                        onClick={(e) => {
                           setCurrentIndex(sIdx);
                           setEvaluation(null);
                           setIsAutoPlaying(false);
                           autoPlayRef.current = false;
                           handleWordClick(e, word);
                        }}
                        className={`cursor-pointer hover:text-indigo-700 hover:underline decoration-indigo-300 underline-offset-2 ${sIdx === currentIndex ? 'text-indigo-900 font-medium' : ''}`}
                     >
                        {word}{' '}
                     </span>
                  ))}
                </span>
              ))}
           </div>
           
           {/* Translation Popup */}
           {selectedWord && (
             <div 
                className="absolute z-20 bg-white shadow-xl border border-indigo-100 rounded-xl p-4 text-left animate-in zoom-in-95 w-64"
                style={{ top: '20%', left: '50%', transform: 'translateX(-50%)' }} 
             >
               <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-lg text-indigo-900">{selectedWord}</h4>
                  <button onClick={() => setSelectedWord(null)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
               </div>
               
               <div className="mb-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">Save to:</label>
                 <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded p-1 mt-1"
                 >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>

               {isTranslating ? (
                 <div className="flex items-center gap-2 text-slate-500 text-sm py-2"><Loader2 size={14} className="animate-spin"/> Translating...</div>
               ) : (
                 <div className="space-y-1 max-h-40 overflow-y-auto">
                   {translationOptions.map((opt, idx) => (
                     <button 
                      key={idx} 
                      onClick={() => handleSaveWord(opt.text)}
                      className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg text-sm flex justify-between items-center group transition-colors"
                     >
                       <span className="text-slate-700 font-medium">{opt.text}</span>
                       <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 font-bold">+ Add</span>
                     </button>
                   ))}
                   {translationOptions.length === 0 && <p className="text-slate-400 text-xs">No translations found.</p>}
                 </div>
               )}
             </div>
           )}

           {/* Active Sentence Focus Bar */}
           <div className="mb-6 w-full bg-white border border-indigo-100 p-4 rounded-xl shadow-sm text-center min-h-[60px] flex items-center justify-center">
             <p className="text-indigo-900 font-medium text-lg">{sentences[currentIndex]}</p>
           </div>

           {/* Evaluation Result */}
           {isEvaluating && (
             <div className="mb-6 flex items-center gap-2 text-indigo-600 animate-pulse">
               <Wand2 size={20} /> Analyzing pronunciation...
             </div>
           )}

           {evaluation && (
             <div className="mb-8 animate-in zoom-in duration-300">
                <div className={`inline-block px-6 py-2 rounded-full text-xl font-black border-2 mb-2 ${evaluation.score >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-amber-200 bg-amber-50 text-amber-600'}`}>
                   Score: {evaluation.score}
                </div>
                <p className="text-slate-600 max-w-md mx-auto text-sm">{evaluation.feedback}</p>
             </div>
           )}

           {/* Main Playback Controls */}
           <div className="flex items-center justify-center gap-8 mb-8 w-full">
              <button 
                onClick={playCurrentSentence} 
                disabled={isPlaying}
                className="flex flex-col items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors group"
              >
                 <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 shadow-sm">
                   <Volume2 size={24} className={isPlaying ? 'animate-pulse' : ''} />
                 </div>
                 <span className="text-xs font-bold">Listen</span>
              </button>

              <button 
                onClick={toggleRecording}
                className="flex flex-col items-center gap-2 group"
              >
                 <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${isRecording ? 'bg-rose-500 text-white scale-110 animate-pulse' : 'bg-indigo-600 text-white hover:scale-105 shadow-indigo-200'}`}>
                   {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={32} />}
                 </div>
                 <span className={`text-xs font-bold ${isRecording ? 'text-rose-500' : 'text-indigo-600'}`}>{isRecording ? 'Stop' : 'Speak'}</span>
              </button>
              
              <button 
                onClick={nextSentence}
                disabled={currentIndex === sentences.length - 1}
                className="flex flex-col items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors group disabled:opacity-30"
              >
                 <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-50">
                   <PlayCircle size={24} />
                 </div>
                 <span className="text-xs font-bold">Next</span>
              </button>
           </div>

           <div className="flex gap-4 w-full">
             <Button variant="outline" onClick={prevSentence} disabled={currentIndex === 0} className="flex-1 text-xs">
               Previous Sentence
             </Button>
             <Button variant="outline" onClick={nextSentence} disabled={currentIndex === sentences.length - 1} className="flex-1 text-xs">
               Next Sentence
             </Button>
           </div>
        </div>
      )}
    </div>
  );
};