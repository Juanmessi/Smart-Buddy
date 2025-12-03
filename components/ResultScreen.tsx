import React from 'react';
import { QuizResult } from '../types';
import { Button } from './Button';
import { Trophy, RefreshCw, Home } from 'lucide-react';

interface ResultScreenProps {
  results: QuizResult[];
  onRestart: () => void;
  onHome: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ results, onRestart, onHome }) => {
  const correctCount = results.filter(r => r.isCorrect).length;
  const score = Math.round((correctCount / results.length) * 100);

  let message = "Good effort!";
  let colorClass = "text-indigo-600";

  if (score === 100) {
    message = "Perfect Score! 🎉";
    colorClass = "text-emerald-500";
  } else if (score >= 80) {
    message = "Great Job! 🌟";
    colorClass = "text-indigo-500";
  } else if (score < 50) {
    message = "Keep Practicing! 💪";
    colorClass = "text-amber-500";
  }

  return (
    <div className="max-w-2xl mx-auto text-center space-y-8 py-10">
      <div className="bg-white rounded-3xl shadow-xl p-10 border border-slate-100">
        <div className={`inline-flex p-6 rounded-full bg-slate-50 mb-6 ${colorClass}`}>
          <Trophy size={64} strokeWidth={1.5} />
        </div>
        
        <h2 className={`text-5xl font-black mb-2 ${colorClass}`}>{score}%</h2>
        <h3 className="text-2xl font-bold text-slate-700 mb-8">{message}</h3>

        <div className="space-y-4 mb-10 text-left max-h-[400px] overflow-y-auto pr-2">
          {results.map((result, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-xl border flex justify-between items-center ${result.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}
            >
              <div>
                <span className="text-xs font-bold opacity-50 block mb-1">Question {idx + 1}</span>
                <div className="font-bold text-slate-800">
                   {result.isCorrect ? (
                     <span className="text-emerald-700">{result.userAnswer}</span>
                   ) : (
                     <div className="flex flex-col">
                        <span className="text-rose-500 line-through text-sm">{result.userAnswer}</span>
                        <span className="text-emerald-700">{result.correctAnswer}</span>
                     </div>
                   )}
                </div>
              </div>
              <div className={`font-bold ${result.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                 {result.isCorrect ? 'Correct' : 'Mistake'}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="secondary" onClick={onRestart}>
             <RefreshCw size={20} /> Retry List
          </Button>
          <Button variant="outline" onClick={onHome}>
             <Home size={20} /> Back to Setup
          </Button>
        </div>
      </div>
    </div>
  );
};