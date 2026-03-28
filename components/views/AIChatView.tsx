'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Send, Sparkles, User, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChatView() {
  const { tasks } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          tasks: tasks.map(t => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            startDate: t.startDate,
            isCompleted: t.isCompleted,
            quadrant: t.quadrant,
            listId: t.listId,
            parentId: t.parentId,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'I apologize — I encountered a temporary issue. Please try again in a moment.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Connection issue. Please check your network and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
  };

  // Simple markdown renderer for bold, italic, bullet points, code
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={i} className="font-headline font-semibold text-base text-primary mt-4 mb-2 italic">{renderInline(line.slice(4))}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} className="font-headline font-semibold text-lg text-primary mt-4 mb-2 italic">{renderInline(line.slice(3))}</h3>;
      }
      // Bullet points
      if (line.match(/^[\-\*]\s/)) {
        return (
          <div key={i} className="flex gap-2.5 ml-2 mb-1.5">
            <span className="text-primary/40 mt-1 shrink-0">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
      }
      // Numbered lists
      if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          return (
            <div key={i} className="flex gap-2.5 ml-2 mb-1.5">
              <span className="text-primary/50 font-label font-bold text-[11px] mt-0.5 shrink-0 w-4 text-right">{match[1]}.</span>
              <span>{renderInline(match[2])}</span>
            </div>
          );
        }
      }
      // Empty line = spacing
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Regular paragraph
      return <p key={i} className="mb-1.5">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text: string) => {
    // Inline code
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-primary/5 text-primary px-1.5 py-0.5 rounded text-[12px] font-mono">{part.slice(1, -1)}</code>;
      }
      // Bold
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`${i}-${j}`} className="font-semibold text-primary">{bp.slice(2, -2)}</strong>;
        }
        // Italic
        const italicParts = bp.split(/(\*[^*]+\*)/g);
        return italicParts.map((ip, k) => {
          if (ip.startsWith('*') && ip.endsWith('*')) {
            return <em key={`${i}-${j}-${k}`} className="italic">{ip.slice(1, -1)}</em>;
          }
          return <span key={`${i}-${j}-${k}`}>{ip}</span>;
        });
      });
    });
  };

  const suggestions = [
    "How should I prioritize my tasks today?",
    "What's the best way to use the Matrix view?",
    "Help me plan my week",
    "How can I break down a big project?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-128px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-headline font-medium text-3xl tracking-tight text-primary italic">AI Assistant</h2>
            <p className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline/60">Powered by Task2Do Intelligence</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-label font-bold tracking-[0.15em] uppercase text-outline/60 hover:text-primary hover:bg-primary/5 rounded-full transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Chat
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white border border-outline-variant/10 shadow-sm hide-scrollbar">
        {messages.length === 0 ? (
          /* Welcome State */
          <div className="flex flex-col items-center justify-center h-full p-12 text-center">
            {/* Animated AI icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative mb-8"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-500 opacity-20 blur-xl animate-pulse" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h3 className="font-headline font-medium text-2xl tracking-tight text-primary italic mb-2">How can I help you today?</h3>
              <p className="text-[13px] font-body text-outline/60 max-w-md leading-relaxed">
                I'm your intelligent assistant within Task2Do. Ask me anything about productivity, task management, or how to make the most of your workflow.
              </p>
            </motion.div>

            {/* Suggestion chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-3 mt-8 max-w-lg justify-center"
            >
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInputValue(suggestion); inputRef.current?.focus(); }}
                  className="px-5 py-2.5 text-[12px] font-body font-medium text-primary/70 bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-full transition-all hover:shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </motion.div>
          </div>
        ) : (
          /* Message Thread */
          <div className="p-6 space-y-6">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                  className={cn(
                    "flex gap-4",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-6 py-4",
                    message.role === 'user'
                      ? "bg-primary text-on-primary rounded-br-md"
                      : "bg-surface-container-low border border-outline-variant/10 rounded-bl-md"
                  )}>
                    {message.role === 'user' ? (
                      <p className="text-[14px] font-body leading-relaxed">{message.content}</p>
                    ) : (
                      <div className="text-[14px] font-body leading-relaxed text-on-surface">
                        {renderMarkdown(message.content)}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 justify-start"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl rounded-bl-md px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary/60 animate-spin" />
                    <span className="text-[12px] font-label font-bold tracking-[0.1em] uppercase text-outline/50">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="mt-6">
        <div className="flex items-end gap-3 bg-white p-3 rounded-2xl border border-outline-variant/10 shadow-sm focus-within:shadow-md focus-within:border-primary/20 transition-all duration-300">
          <div className="ml-2 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-600/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your tasks or productivity..."
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 py-2 font-body text-[15px] tracking-tight placeholder:text-outline/40 outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
              inputValue.trim() && !isLoading
                ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 scale-100 hover:scale-105"
                : "bg-outline-variant/10 text-outline/30 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/30 mt-3">
          Task2Do AI • Context-aware productivity assistant
        </p>
      </div>
    </div>
  );
}
