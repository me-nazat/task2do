'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { 
  format, 
  startOfWeek, 
  eachDayOfInterval, 
  addDays, 
  isSameDay, 
  isToday,
  subDays,
  parseISO
} from 'date-fns';
import { Plus, Check, X, Flame, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { getHabits, createHabit, toggleHabitLog } from '@/actions/habit';
import { Modal } from '@/components/ui/Modal';

interface HabitWithLogs {
  id: string;
  name: string;
  frequency: string;
  logs: { id: string; habitId: string; date: string; status: string }[];
}

export function HabitTrackerView() {
  const { user } = useStore();
  const [habits, setHabits] = useState<HabitWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddHabitModalOpen, setIsAddHabitModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  useEffect(() => {
    const fetchHabits = async () => {
      if (user) {
        const data = await getHabits(user.id);
        setHabits(data);
      }
      setLoading(false);
    };
    fetchHabits();
  }, [user]);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const handleToggleHabit = async (habitId: string, date: string) => {
    if (!user) return;
    // Optimistic update
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const existingLog = h.logs.find(l => l.date === date);
        if (existingLog) {
          return { ...h, logs: h.logs.filter(l => l.date !== date) };
        } else {
          return { ...h, logs: [...h.logs, { id: 'temp', habitId, date, status: 'completed' }] };
        }
      }
      return h;
    }));

    await toggleHabitLog(habitId, date, 'completed');
    const data = await getHabits(user.id);
    setHabits(data);
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHabitName.trim()) return;
    
    await createHabit({ name: newHabitName.trim(), frequency: 'daily', userId: user.id });
    const data = await getHabits(user.id);
    setHabits(data);
    setNewHabitName('');
    setIsAddHabitModalOpen(false);
  };

  if (loading) return <div className="flex items-center justify-center h-full font-headline font-bold tracking-widest uppercase text-outline">Loading habits...</div>;

  return (
    <div className="flex flex-col h-full gap-8">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest border-l-4 border-primary p-6 shadow-sm flex items-center gap-6">
          <div className="w-12 h-12 bg-primary text-on-primary-fixed flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline mb-1">COMPLETION RATE</p>
            <p className="text-3xl font-black font-headline tracking-tighter text-on-surface">
              {habits.length > 0 ? Math.round((habits.reduce((acc, h) => acc + h.logs.length, 0) / (habits.length * 7)) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border-l-4 border-warning p-6 shadow-sm flex items-center gap-6">
          <div className="w-12 h-12 bg-warning text-warning-on-container flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline mb-1">TOTAL CHECK-INS</p>
            <p className="text-3xl font-black font-headline tracking-tighter text-on-surface">
              {habits.reduce((acc, h) => acc + h.logs.length, 0)}
            </p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border-l-4 border-info p-6 shadow-sm flex items-center gap-6">
          <div className="w-12 h-12 bg-info text-info-on-container flex items-center justify-center">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline mb-1">ACTIVE HABITS</p>
            <p className="text-3xl font-black font-headline tracking-tighter text-on-surface">{habits.length}</p>
          </div>
        </div>
      </div>

      {/* Habits List */}
      <div className="flex-1 bg-surface-container-lowest border-2 border-transparent shadow-sm overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b-2 border-outline-variant bg-surface-container-low flex items-center justify-between">
          <h2 className="text-2xl font-black font-headline tracking-tighter uppercase text-on-surface">WEEKLY PROGRESS</h2>
          <button 
            onClick={() => setIsAddHabitModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 bg-primary text-on-primary-fixed text-[10px] font-label font-bold tracking-[0.2em] uppercase hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            NEW HABIT
          </button>
        </div>

        <Modal 
          isOpen={isAddHabitModalOpen} 
          onClose={() => setIsAddHabitModalOpen(false)}
          title="New Habit"
        >
          <form onSubmit={handleAddHabit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-outline/60">Habit Name</label>
              <input 
                autoFocus
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="e.g. Morning Meditation"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-4 font-body text-lg focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-label font-bold tracking-[0.2em] uppercase hover:bg-primary/90 transition-all shadow-md"
            >
              Create Habit
            </button>
          </form>
        </Modal>

        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-outline-variant">
                <th className="px-6 py-4 text-left text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline w-1/3">HABIT</th>
                {weekDays.map(day => (
                  <th key={day.toString()} className="px-2 py-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline">{format(day, 'EEE')}</span>
                      <span className={cn(
                        "w-8 h-8 flex items-center justify-center text-sm font-headline font-bold transition-all",
                        isToday(day) ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-headline font-bold text-sm tracking-widest uppercase text-on-surface">{habit.name}</p>
                        <p className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline mt-1">{habit.frequency}</p>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-surface-container-high transition-colors text-on-surface-variant">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCompleted = habit.logs.some(l => l.date === dateStr);
                    const isFuturistic = day > today;

                    return (
                      <td key={day.toString()} className="px-2 py-6 text-center">
                        <button
                          disabled={isFuturistic}
                          onClick={() => handleToggleHabit(habit.id, dateStr)}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center transition-all border-2",
                            isCompleted 
                              ? "bg-primary border-primary text-on-primary-fixed shadow-sm" 
                              : "bg-transparent border-outline hover:border-primary text-transparent",
                            isFuturistic && "opacity-20 cursor-not-allowed border-dashed"
                          )}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {habits.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline">
                    NO HABITS TRACKED YET. START BY ADDING ONE!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
