'use client';

import { formatDistanceToNow } from 'date-fns';
import { History, MessageSquareText } from 'lucide-react';
import { ChatSession } from '@/lib/ai/task2do-chat';
import { cn } from '@/lib/utils';

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function ChatHistoryPanel({
  sessions,
  activeSessionId,
  onSelectSession,
}: ChatHistoryPanelProps) {
  return (
    <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[360px] overflow-hidden rounded-3xl border border-outline-variant/10 bg-white shadow-2xl shadow-primary/10">
      <div className="border-b border-outline-variant/10 bg-gradient-to-r from-primary/[0.03] to-indigo-500/[0.04] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <History className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-outline/45">
              Conversation History
            </p>
            <p className="mt-1 text-[13px] text-outline/60">
              Resume any previous Task2Do AI session.
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-3 py-3 hide-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/5 text-primary/45">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <p className="mt-4 font-headline text-lg italic text-primary">
              No saved chats yet
            </p>
            <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-outline/55">
              Your conversations will appear here automatically after your first exchange.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const preview = session.messages[session.messages.length - 1]?.content || 'Untitled conversation';

              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                    session.id === activeSessionId
                      ? "border-primary/20 bg-primary/[0.05] shadow-sm"
                      : "border-transparent bg-white hover:border-outline-variant/10 hover:bg-primary/[0.02]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[14px] font-semibold text-primary/85">
                        {session.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-outline/60">
                        {preview}
                      </p>
                    </div>
                    <span className="shrink-0 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/35">
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
