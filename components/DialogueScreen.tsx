
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { ArrowLeft, Send, Volume2, User, Bot, Loader2, X, Mic, Keyboard, Languages } from 'lucide-react';
import { generateChatResponse, generateSpeechAudio, translateText, simpleTranslate } from '../services/geminiService';
import { playPcmAudio } from '../utils/audioUtils';
import { ChatMessage, TranslationOption, WordPair } from '../types';

interface DialogueScreenProps {
  topic: string;
  onBack: () => void;
  categories: string[];
  onAddToLibrary: (word: WordPair, category: string) => void;
}

// Add type for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const DialogueScreen: React.FC<DialogueScreenProps> = ({ topic, onBack, categories, onAddToLibrary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Input Mode
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isListening, setIsListening] = useState(false);
  const [isTranslatingInput, setIsTranslatingInput] = useState(false);

  // Popup state
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [translationOptions, setTranslationOptions] = useState<TranslationOption[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Uncategorized');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; // Default to English, could toggle

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Browser does not support Speech Recognition.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Initial Greeting
  useEffect(() => {
    const startConversation = async () => {
      setIsProcessing(true);
      // Create a dummy history to prompt the opening line
      const initialHistory: ChatMessage[] = [
        { id: '0', role: 'user', text: `Hi, let's start the roleplay about ${topic}.` }
      ];
      
      const text = await generateChatResponse(initialHistory, topic);
      const audio = await generateSpeechAudio(text, true);
      
      setMessages([
        { id: Date.now().toString(), role: 'ai', text, audioBase64: audio }
      ]);
      
      setIsProcessing(false);
      await playPcmAudio(audio);
    };

    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      // Get AI Response
      const responseText = await generateChatResponse([...messages, userMsg], topic);
      const responseAudio = await generateSpeechAudio(responseText, true);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: responseText,
        audioBase64: responseAudio
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsProcessing(false);
      
      // Auto play response
      setIsPlayingAudio(true);
      await playPcmAudio(responseAudio);
      setIsPlayingAudio(false);

    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const handleTranslateInput = async () => {
    if (!inputText.trim()) return;
    setIsTranslatingInput(true);
    try {
      const translated = await simpleTranslate(inputText);
      setInputText(translated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslatingInput(false);
    }
  };

  const handlePlayMessage = async (msg: ChatMessage) => {
    if (msg.audioBase64) {
      setIsPlayingAudio(true);
      await playPcmAudio(msg.audioBase64);
      setIsPlayingAudio(false);
    } else if (msg.text) {
        // Generate on fly if missing (e.g. user messages)
      setIsPlayingAudio(true);
      const audio = await generateSpeechAudio(msg.text, true);
      await playPcmAudio(audio);
      setIsPlayingAudio(false);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-100px)] flex flex-col">
       {/* Header */}
       <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft /></button>
            <div>
              <h2 className="font-bold text-slate-800">Roleplay: {topic}</h2>
              <p className="text-xs text-slate-500">Voice-First AI Tutor</p>
            </div>
         </div>
       </div>

       {/* Chat Area */}
       <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4 relative">
          {messages.length === 0 && isProcessing && (
             <div className="text-center text-slate-400 mt-10 flex flex-col items-center">
               <Loader2 className="animate-spin mb-2" />
               <p>Setting up scenario...</p>
             </div>
          )}

          {messages.map((msg) => (
             <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'}`}>
                   {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                   <p className="leading-relaxed">
                     {msg.text.split(' ').map((word, idx) => (
                        <span 
                          key={idx}
                          onClick={(e) => msg.role === 'ai' ? handleWordClick(e, word) : undefined}
                          className={msg.role === 'ai' ? "cursor-pointer hover:underline decoration-emerald-300 hover:text-emerald-700" : ""}
                        >
                          {word}{' '}
                        </span>
                     ))}
                   </p>
                   <button 
                     onClick={() => handlePlayMessage(msg)}
                     disabled={isPlayingAudio}
                     className={`mt-2 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors ${isPlayingAudio ? 'opacity-50' : ''}`}
                   >
                     <Volume2 size={14} />
                   </button>
                </div>
             </div>
          ))}
          
          {isProcessing && messages.length > 0 && (
             <div className="flex gap-3">
               <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><Bot size={16}/></div>
               <div className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-2">
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />

          {/* Translation Popup Overlay */}
          {selectedWord && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 animate-in zoom-in-95">
                   <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-lg text-indigo-900">{selectedWord}</h4>
                      <button onClick={() => setSelectedWord(null)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
                   </div>
                   <div className="mb-2">
                     <select 
                        value={selectedCategory} 
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded p-1"
                     >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   {isTranslating ? (
                     <div className="flex items-center gap-2 text-slate-500 text-sm py-4"><Loader2 size={18} className="animate-spin"/> Translating...</div>
                   ) : (
                     <div className="space-y-2 max-h-40 overflow-y-auto">
                       {translationOptions.map((opt, idx) => (
                         <button 
                          key={idx} 
                          onClick={() => handleSaveWord(opt.text)}
                          className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg text-sm flex justify-between items-center group border border-slate-100 hover:border-indigo-200"
                         >
                           <span className="text-slate-700 font-medium">{opt.text} <span className="text-xs text-slate-400">({opt.context})</span></span>
                           <span className="text-xs text-white bg-indigo-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 font-bold">Add</span>
                         </button>
                       ))}
                     </div>
                   )}
                </div>
             </div>
          )}
       </div>

       {/* Input Area */}
       <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 flex flex-col gap-3">
          
          {/* Main Voice Control */}
          <div className="flex items-center justify-center relative">
              <button 
                onClick={toggleListening}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${isListening ? 'bg-rose-500 text-white scale-110 animate-pulse ring-4 ring-rose-200' : 'bg-indigo-600 text-white hover:scale-105 ring-4 ring-indigo-100'}`}
              >
                 {isListening ? <div className="w-6 h-6 bg-white rounded-sm animate-pulse" /> : <Mic size={32} />}
              </button>

              <div className="absolute right-0 flex gap-2">
                 <button onClick={() => setInputMode(prev => prev === 'voice' ? 'text' : 'voice')} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-full hover:bg-indigo-50 transition-colors" title="Toggle Keyboard">
                   {inputMode === 'voice' ? <Keyboard size={20} /> : <Mic size={20} />}
                 </button>
              </div>
          </div>

          <div className="text-center text-xs text-slate-400 font-medium min-h-[1.5em]">
             {isListening ? "Listening..." : "Tap to Speak"}
          </div>

          {/* Text Editing Area (Expandable) */}
          {(inputMode === 'text' || inputText) && (
            <div className="animate-in slide-in-from-bottom-2 flex gap-2 items-end bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-200 transition-all">
              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                  }}
                  placeholder="Type or edit message..."
                  className="w-full bg-transparent outline-none resize-none max-h-24 py-2 px-1 text-slate-700"
                  rows={1}
                />
                {/* Instant Translation Button */}
                {inputText && (
                  <button 
                    onClick={handleTranslateInput}
                    disabled={isTranslatingInput}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 bg-white/50 hover:bg-white rounded-lg transition-colors"
                    title="Instant Translate"
                  >
                     {isTranslatingInput ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                  </button>
                )}
              </div>
              
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputText.trim() || isProcessing}
                className="h-[40px] w-[40px] !px-0 flex items-center justify-center rounded-lg shadow-sm"
              >
                <Send size={18} />
              </Button>
            </div>
          )}
       </div>
    </div>
  );
};
