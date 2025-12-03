import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordPair, QuizConfig, QuizResult, LanguageMode, SpeakingEvaluation } from '../types';
import { generateSpeechAudio, generateHintImage, generateContextSentence, evaluatePronunciation } from '../services/geminiService';
import { playPcmAudio } from '../utils/audioUtils';
import { AudioRecorder } from '../utils/audioRecorder';
import { Button } from './Button';
import { Volume2, ArrowRight, CheckCircle2, XCircle, Eye, EyeOff, RotateCcw, Image as ImageIcon, MessageSquareQuote, Mic, Square, Ear } from 'lucide-react';

interface QuizScreenProps {
  words: WordPair[];
  config: QuizConfig;
  onComplete: (results: QuizResult[]) => void;
  onCancel: () => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({ words, config, onComplete, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [results, setResults] = useState<QuizResult[]>([]);
  const [showHint, setShowHint] = useState(false);
  
  // Feature States
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [showImagePanel, setShowImagePanel] = useState(false);

  const [contextSentence, setContextSentence] = useState<string | null>(null);
  const [showContextText, setShowContextText] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Speaking/Grading State
  const [isRecording, setIsRecording] = useState(false);
  const [speakingScore, setSpeakingScore] = useState<SpeakingEvaluation | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<AudioRecorder>(new AudioRecorder());

  // Audio Cache
  const audioCache = useRef<Map<string, Promise<string>>>(new Map());
  const imageCache = useRef<Map<string, string>>(new Map());
  const contextCache = useRef<Map<string, string>>(new Map());

  const [queue] = useState<WordPair[]>(() => {
    const list = [...words];
    if (config.randomize) {
      return list.sort(() => Math.random() - 0.5);
    }
    return list;
  });

  const currentWord = queue[currentIndex];

  const getPromptText = useCallback((word: WordPair) => {
    return config.promptLanguage === LanguageMode.ENGLISH ? word.english : word.chinese;
  }, [config.promptLanguage]);

  const getTargetText = useCallback((word: WordPair) => {
    return config.answerLanguage === LanguageMode.ENGLISH ? word.english : word.chinese;
  }, [config.answerLanguage]);

  const getAudioPromise = useCallback((word: WordPair, textOverride?: string): Promise<string> => {
    const textToSpeak = textOverride || getPromptText(word);
    const isEnglish = textOverride ? true : config.promptLanguage === LanguageMode.ENGLISH; // Context is always English
    const cacheKey = `${word.id}-${textToSpeak}`;
    
    if (audioCache.current.has(cacheKey)) {
      return audioCache.current.get(cacheKey)!;
    }

    const promise = generateSpeechAudio(textToSpeak, isEnglish)
      .catch(err => {
        audioCache.current.delete(cacheKey);
        throw err;
      });

    audioCache.current.set(cacheKey, promise);
    return promise;
  }, [config.promptLanguage, getPromptText]);

  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      getAudioPromise(queue[nextIndex]);
    }
  }, [currentIndex, queue, getAudioPromise]);

  const playAudio = useCallback(async (text?: string) => {
    if (!currentWord) return;
    
    setIsPlaying(true);
    try {
      const audioBase64 = await getAudioPromise(currentWord, text);
      await playPcmAudio(audioBase64);
    } catch (error) {
      console.error("Audio playback failed", error);
    } finally {
      setIsPlaying(false);
      if (!text) setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentWord, getAudioPromise]);

  useEffect(() => {
    let isMounted = true;
    const playSequence = async () => {
      await playAudio();
      if (!isMounted) return;
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!isMounted) return;
      await playAudio();
    };
    const timer = setTimeout(() => {
      playSequence();
    }, 500);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentIndex, playAudio]);

  // Reset specific states on new word
  useEffect(() => {
    setImageUrl(null);
    setShowImagePanel(false);
    setIsLoadingImage(false);
    setContextSentence(null);
    setShowContextText(false);
    setIsLoadingContext(false);
    setSpeakingScore(null);
  }, [currentIndex]);

  const handleGenerateImage = async () => {
    if (showImagePanel && imageUrl) {
      setShowImagePanel(false);
      return;
    }
    setShowImagePanel(true);
    if (imageCache.current.has(currentWord.id)) {
      setImageUrl(imageCache.current.get(currentWord.id)!);
      return;
    }
    setIsLoadingImage(true);
    try {
      const result = await generateHintImage(currentWord.english);
      if (result) {
        setImageUrl(result);
        imageCache.current.set(currentWord.id, result);
      }
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleGenerateContext = async () => {
    // If we already have it, just play audio
    if (contextSentence) {
      await playAudio(contextSentence);
      return;
    }
    
    // Check cache
    if (contextCache.current.has(currentWord.id)) {
      const ctx = contextCache.current.get(currentWord.id)!;
      setContextSentence(ctx);
      setShowContextText(false); // Keep hidden initially
      await playAudio(ctx);
      return;
    }

    setIsLoadingContext(true);
    try {
      const ctx = await generateContextSentence(currentWord.english);
      if (ctx) {
        setContextSentence(ctx);
        contextCache.current.set(currentWord.id, ctx);
        setShowContextText(false); // Keep hidden initially
        await playAudio(ctx);
      }
    } finally {
      setIsLoadingContext(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsGrading(true);
      try {
        const base64 = await recorder.current.stop();
        // If context is active, check against context, otherwise check against word
        const targetText = contextSentence || currentWord.english;
        
        const result = await evaluatePronunciation(base64, targetText);
        setSpeakingScore(result);
      } catch (e) {
        console.error(e);
      } finally {
        setIsGrading(false);
      }
    } else {
      // START RECORDING
      // If we have a context sentence that is hidden, reveal it now so user can read it
      if (contextSentence) {
        setShowContextText(true);
      }
      setSpeakingScore(null);
      await recorder.current.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;

    setIsSubmitting(true);
    const target = getTargetText(currentWord).toLowerCase().trim();
    const input = userAnswer.toLowerCase().trim();
    const normalize = (str: string) => str.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ");
    
    const isCorrect = normalize(input) === normalize(target);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
      setTimeout(() => {
        handleNext(true);
      }, 1000);
    } else {
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleNext = (wasCorrect: boolean) => {
    const result: QuizResult = {
      wordId: currentWord.id,
      isCorrect: wasCorrect,
      userAnswer: userAnswer,
      correctAnswer: getTargetText(currentWord),
      timestamp: Date.now()
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setFeedback('idle');
      setShowHint(false);
      setIsSubmitting(false);
    } else {
      onComplete(newResults);
    }
  };

  const renderSpellingFeedback = () => {
    const target = getTargetText(currentWord).toLowerCase().trim();
    const input = userAnswer.toLowerCase().trim();
    const targetChars = target.split('');
    const inputChars = input.split('');

    return (
      <div className="flex justify-center gap-1 mb-4 flex-wrap">
        {inputChars.map((char, idx) => {
          const isMatch = idx < targetChars.length && char === targetChars[idx];
          return (
            <span key={idx} className={`text-xl font-mono font-bold px-1 rounded ${isMatch ? 'text-emerald-600 bg-emerald-100' : 'text-rose-600 bg-rose-100'}`}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col justify-center pb-10">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-bold text-slate-500 mb-2">
          <span>Word {currentIndex + 1} of {queue.length}</span>
          <span>{Math.round(((currentIndex) / queue.length) * 100)}%</span>
        </div>
        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500 ease-out" style={{ width: `${((currentIndex) / queue.length) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className={`bg-white rounded-3xl shadow-2xl p-8 transition-all border-2 ${feedback === 'correct' ? 'border-emerald-400' : feedback === 'incorrect' ? 'border-rose-400' : 'border-transparent'}`}>
        
        {/* Main Audio Play */}
        <div className="flex flex-col items-center justify-center mb-4 gap-4">
          <button
            onClick={() => playAudio()}
            disabled={isPlaying}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-100 scale-110 text-indigo-400' : 'bg-indigo-600 text-white shadow-xl hover:scale-105'}`}
          >
            <Volume2 size={40} className={isPlaying ? "animate-pulse" : ""} />
          </button>
        </div>

        {/* Helper Toolbar */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
            <button onClick={() => playAudio()} className="btn-tool bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 p-2 rounded-lg flex items-center gap-1 text-xs font-bold">
               <RotateCcw size={14} /> Replay
            </button>
            <button onClick={handleGenerateImage} className="btn-tool bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-600 p-2 rounded-lg flex items-center gap-1 text-xs font-bold">
               <ImageIcon size={14} /> {showImagePanel ? 'Hide Pic' : 'Hint Pic'}
            </button>
            <button onClick={handleGenerateContext} disabled={isLoadingContext} className="btn-tool bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-600 p-2 rounded-lg flex items-center gap-1 text-xs font-bold">
               {/* If we have a context sentence but it's hidden, show 'Replay Sentence' icon */}
               {contextSentence && !showContextText ? <Ear size={14}/> : <MessageSquareQuote size={14} />} 
               {isLoadingContext ? 'Thinking...' : (contextSentence ? 'Listen Sentence' : 'Gen Sentence')}
            </button>
             <button onClick={toggleRecording} className={`btn-tool p-2 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-600'}`}>
               {isRecording ? <Square size={14} /> : <Mic size={14} />} Speak & Reveal
            </button>
        </div>

        {/* Feature Panels (Image / Context / Speaking) */}
        {showImagePanel && imageUrl && (
           <div className="mb-6 flex justify-center animate-in fade-in zoom-in">
             <img src={imageUrl} alt="Hint" className="w-32 h-32 object-cover rounded-xl border-2 border-purple-100" />
           </div>
        )}

        {contextSentence && showContextText && (
           <div className="mb-6 bg-amber-50 border border-amber-100 p-3 rounded-xl text-center animate-in fade-in">
              <p className="text-amber-800 text-sm font-medium italic">"{contextSentence}"</p>
           </div>
        )}
        
        {/* Feedback when sentence is generated but hidden */}
        {contextSentence && !showContextText && !isPlaying && (
          <div className="mb-6 text-center text-xs text-amber-500 font-medium animate-pulse">
             Example sentence audio ready. Click "Speak" to reveal text.
          </div>
        )}

        {isGrading && <div className="text-center text-xs text-slate-400 mb-4">Analyzing pronunciation...</div>}
        
        {speakingScore && (
           <div className="mb-6 bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center animate-in fade-in">
              <div className="text-emerald-800 font-bold text-lg">Score: {speakingScore.score}/100</div>
              <p className="text-emerald-600 text-xs">{speakingScore.feedback}</p>
           </div>
        )}

        <div className="text-center mb-6">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Write in {config.answerLanguage}</p>
        </div>

        {/* Input */}
        <div className="relative mb-2">
          <input
            ref={inputRef}
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              if (feedback !== 'idle') setFeedback('idle');
            }}
            onKeyDown={(e) => e.key === 'Enter' && feedback !== 'correct' && handleSubmit()}
            disabled={feedback === 'correct'}
            className={`w-full text-center text-3xl font-bold bg-slate-50 border-b-4 focus:outline-none py-4 transition-colors ${
              feedback === 'incorrect' ? 'border-rose-500 text-rose-600 bg-rose-50' : feedback === 'correct' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-slate-300 focus:border-indigo-500 text-slate-800'
            }`}
            autoComplete="off"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
             {feedback === 'correct' && <CheckCircle2 className="text-emerald-500" size={32} />}
             {feedback === 'incorrect' && <XCircle className="text-rose-500" size={32} />}
          </div>
        </div>

        {/* Spelling Feedback */}
        <div className="min-h-[2rem] text-center mb-4">
            {feedback === 'incorrect' && renderSpellingFeedback()}
        </div>

        {feedback === 'incorrect' && (
          <div className="mb-6 text-center">
             <button onClick={() => setShowHint(!showHint)} className="text-sm flex items-center gap-1 text-slate-500 hover:text-indigo-600 justify-center mx-auto mb-2">
               {showHint ? <EyeOff size={16}/> : <Eye size={16}/>} {showHint ? 'Hide Answer' : 'Show Answer'}
             </button>
             {showHint && (
                <p className="text-indigo-600 font-medium tracking-widest bg-indigo-50 inline-block px-3 py-1 rounded text-lg">{getTargetText(currentWord)}</p>
             )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => feedback === 'incorrect' ? handleNext(false) : onCancel()}>
            {feedback === 'incorrect' ? 'Skip' : 'Exit'}
          </Button>
          <Button onClick={handleSubmit} disabled={!userAnswer.trim() || feedback === 'correct'}>
             {feedback === 'incorrect' ? 'Retry' : 'Check'} <ArrowRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};