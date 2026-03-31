'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createTask } from '@/actions/task';
import {
  type AIProvider,
  ChatApiResponse,
  ChatMessage,
  ChatListContext,
  TaskProposal,
  createLocalChatId,
  getAIProviderDescription,
  getAIProviderLabel,
  isAIProvider,
} from '@/lib/ai/task2do-chat';
import { cn } from '@/lib/utils';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';
import { useStore, Task } from '@/store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { History, Loader2, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import { ChatHistoryPanel } from '@/components/views/ai-chat/ChatHistoryPanel';
import { ProposalEditorModal } from '@/components/views/ai-chat/ProposalEditorModal';
import { TaskProposalCard } from '@/components/views/ai-chat/TaskProposalCard';

type RequestMessage = Pick<ChatMessage, 'role' | 'content' | 'proposal' | 'proposalStatus'>;

const suggestions = [
  'Schedule Sunday football at 4pm',
  'Plan my week using the tasks already in Task2Do',
  'What should I focus on today?',
  'Turn my inbox into a prioritized action plan',
];

function createAssistantMessage(
  content: string,
  provider: AIProvider,
  proposal?: TaskProposal | null,
  providerLabel?: string
): ChatMessage {
  return {
    id: createLocalChatId('assistant'),
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    assistantProvider: provider,
    assistantLabel: providerLabel || getAIProviderLabel(provider),
    proposal: proposal ?? null,
    proposalStatus: proposal ? 'pending' : null,
    proposalTaskId: null,
  };
}

export function AIChatView() {
  const {
    tasks,
    lists,
    user,
    isDemoMode,
    setAuthModalOpen,
    addTask,
    updateTask: updateTaskState,
    deleteTask,
    chatSessions,
    activeChatSessionId,
    hasHydratedChat,
    selectedAIProvider,
    ensureChatSession,
    startNewChat,
    setSelectedAIProvider,
    setActiveChatSession,
    appendChatMessage,
    updateChatMessage,
  } = useStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [submittingMessageId, setSubmittingMessageId] = useState<string | null>(null);

  const viewerId = user?.id ?? 'guest';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const sessions = useMemo(() => (
    [...chatSessions]
      .filter((session) => session.ownerId === viewerId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  ), [chatSessions, viewerId]);

  const activeSession = useMemo(() => (
    sessions.find((session) => session.id === activeChatSessionId) ?? sessions[0] ?? null
  ), [sessions, activeChatSessionId]);

  const messages = useMemo(() => (
    activeSession?.messages ?? []
  ), [activeSession]);
  const historySessions = useMemo(() => (
    sessions.filter((session) => session.messages.length > 0)
  ), [sessions]);
  const activeProviderLabel = useMemo(() => (
    getAIProviderLabel(selectedAIProvider)
  ), [selectedAIProvider]);
  const activeProviderDescription = useMemo(() => (
    getAIProviderDescription(selectedAIProvider)
  ), [selectedAIProvider]);

  const editingMessage = useMemo(() => (
    messages.find((message) => message.id === editingMessageId) ?? null
  ), [editingMessageId, messages]);

  useEffect(() => {
    if (!hasHydratedChat) {
      return;
    }

    // BUG 4 FIX: On hard refresh/initial load, start a new chat instead of loading previous session
    // Check if this is a fresh page load by checking if we have an active session that was just hydrated
    const isFreshLoad = !sessionStorage.getItem('task2do-chat-initialized');
    if (isFreshLoad) {
      sessionStorage.setItem('task2do-chat-initialized', 'true');
      startNewChat(viewerId);
    } else {
      ensureChatSession(viewerId);
    }
  }, [ensureChatSession, hasHydratedChat, viewerId, startNewChat]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [hasHydratedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = inputRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHistoryOpen]);

  const listOptions: ChatListContext[] = useMemo(() => (
    lists.map((list) => ({
      id: list.id,
      name: list.name,
      color: list.color,
    }))
  ), [lists]);

  const sanitizeProposal = (proposal: TaskProposal): TaskProposal => {
    const matchingList = proposal.listId
      ? listOptions.find((list) => list.id === proposal.listId)
      : null;

    const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      ...proposal,
      listId: matchingList?.id || null,
      listName: matchingList?.name || proposal.listName || null,
      timezone: proposal.timezone || fallbackTimezone,
      action: 'create-task',
    };
  };

  const buildTaskFromProposal = (proposal: TaskProposal, tempId: string): Task => {
    const startDate = proposal.startDate ? new Date(proposal.startDate) : null;
    const endDate = proposal.endDate ? new Date(proposal.endDate) : null;
    const reminderAt = startDate && proposal.reminderOffsetMinutes !== null
      ? new Date(startDate.getTime() - proposal.reminderOffsetMinutes * 60_000)
      : null;

    return {
      id: tempId,
      title: proposal.title,
      description: proposal.description,
      isCompleted: proposal.status === 'done',
      priority: proposal.priority,
      startDate,
      endDate,
      isAllDay: proposal.isAllDay,
      listId: proposal.listId,
      quadrant: proposal.quadrant,
      parentId: null,
      timezone: proposal.timezone,
      reminderAt,
      recurrence: proposal.recurrence,
      status: proposal.status,
    };
  };

  const createTaskFromProposal = async (
    proposalInput: TaskProposal,
    messageId: string,
    status: 'approved' | 'edited'
  ) => {
    const sessionId = activeSession?.id;

    if (!sessionId) {
      return false;
    }

    if (!user && !isDemoMode) {
      setAuthModalOpen(true);
      return false;
    }

    const currentUser = user;

    const proposal = sanitizeProposal(proposalInput);
    const tempId = createLocalChatId('temp-task');
    const optimisticTask = buildTaskFromProposal(proposal, tempId);
    const startDate = optimisticTask.startDate || undefined;
    const endDate = optimisticTask.endDate || undefined;
    const reminderAt = optimisticTask.reminderAt || undefined;

    setSubmittingMessageId(messageId);
    addTask(optimisticTask);

    if (isDemoMode) {
      updateChatMessage(sessionId, messageId, {
        proposal,
        proposalStatus: status,
        proposalTaskId: tempId,
      });
      setSubmittingMessageId(null);
      return true;
    }

    if (!currentUser) {
      return false;
    }

    try {
      const id = unwrapDatabaseResult(await createTask({
        title: proposal.title,
        description: proposal.description || undefined,
        listId: proposal.listId || undefined,
        startDate,
        endDate,
        isAllDay: proposal.isAllDay,
        timezone: proposal.timezone || undefined,
        priority: proposal.priority,
        status: proposal.status,
        quadrant: proposal.quadrant || undefined,
        reminderAt,
        isCompleted: proposal.status === 'done',
        recurrence: proposal.recurrence || undefined,
        userId: currentUser.id,
      }));

      updateTaskState(tempId, { id });
      updateChatMessage(sessionId, messageId, {
        proposal,
        proposalStatus: status,
        proposalTaskId: id,
      });
      return true;
    } catch (error) {
      deleteTask(tempId);
      alert(getClientErrorMessage(error, 'Unable to create that task right now.'));
      return false;
    } finally {
      setSubmittingMessageId(null);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !hasHydratedChat) {
      return;
    }

    const providerToUse = selectedAIProvider;
    const sessionId = activeSession?.id ?? ensureChatSession(viewerId);
    const content = inputValue.trim();
    const userMessage: ChatMessage = {
      id: createLocalChatId('user'),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    const conversationMessages = [...messages, userMessage];

    appendChatMessage(sessionId, userMessage);
    setInputValue('');
    setIsLoading(true);
    setIsHistoryOpen(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerToUse,
          messages: conversationMessages.slice(-40).map((message): RequestMessage => ({
            role: message.role,
            content: message.content,
            proposal: message.proposal ?? null,
            proposalStatus: message.proposalStatus ?? null,
          })),
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            startDate: task.startDate,
            endDate: task.endDate,
            isCompleted: task.isCompleted,
            quadrant: task.quadrant,
            listId: task.listId,
            parentId: task.parentId,
            recurrence: task.recurrence,
          })),
          lists: listOptions,
          now: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await response.json() as ChatApiResponse & { error?: string };
      const responseProvider = isAIProvider(data.provider) ? data.provider : providerToUse;
      const responseProviderLabel = data.providerLabel || getAIProviderLabel(responseProvider);

      if (!response.ok) {
        appendChatMessage(
          sessionId,
          createAssistantMessage(
            'I apologize — I encountered a temporary issue. Please try again in a moment.',
            responseProvider,
            null,
            responseProviderLabel
          )
        );
        return;
      }

      appendChatMessage(
        sessionId,
        createAssistantMessage(
          data.message || 'I prepared a draft for you below.',
          responseProvider,
          data.proposal ?? null,
          responseProviderLabel
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      appendChatMessage(
        sessionId,
        createAssistantMessage(
          'Connection issue. Please check your network and try again.',
          providerToUse
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProposal = async (message: ChatMessage) => {
    if (!message.proposal) {
      return;
    }

    await createTaskFromProposal(message.proposal, message.id, 'approved');
  };

  const handleSubmitEditedProposal = async (proposal: TaskProposal) => {
    if (!editingMessage) {
      return;
    }

    const created = await createTaskFromProposal(proposal, editingMessage.id, 'edited');

    if (created) {
      setEditingMessageId(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    startNewChat(viewerId);
    setEditingMessageId(null);
    setIsHistoryOpen(false);
    setInputValue('');
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={index} className="mb-2 mt-4 font-headline text-base font-semibold italic text-primary">
            {renderInline(line.slice(4))}
          </h4>
        );
      }

      if (line.startsWith('## ')) {
        return (
          <h3 key={index} className="mb-2 mt-4 font-headline text-lg font-semibold italic text-primary">
            {renderInline(line.slice(3))}
          </h3>
        );
      }

      if (line.match(/^[\-\*]\s/)) {
        return (
          <div key={index} className="mb-1.5 ml-2 flex gap-2.5">
            <span className="mt-1 shrink-0 text-primary/40">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
      }

      if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+)\.\s(.*)$/);

        if (match) {
          return (
            <div key={index} className="mb-1.5 ml-2 flex gap-2.5">
              <span className="mt-0.5 w-4 shrink-0 text-right font-label text-[11px] font-bold text-primary/50">
                {match[1]}.
              </span>
              <span>{renderInline(match[2])}</span>
            </div>
          );
        }
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2" />;
      }

      return (
        <p key={index} className="mb-1.5">
          {renderInline(line)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    const codeParts = text.split(/(`[^`]+`)/g);

    return codeParts.map((part, partIndex) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={partIndex} className="rounded bg-primary/5 px-1.5 py-0.5 font-mono text-[12px] text-primary">
            {part.slice(1, -1)}
          </code>
        );
      }

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);

      return boldParts.map((boldPart, boldIndex) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return (
            <strong key={`${partIndex}-${boldIndex}`} className="font-semibold text-primary">
              {boldPart.slice(2, -2)}
            </strong>
          );
        }

        const italicParts = boldPart.split(/(\*[^*]+\*)/g);

        return italicParts.map((italicPart, italicIndex) => {
          if (italicPart.startsWith('*') && italicPart.endsWith('*')) {
            return (
              <em key={`${partIndex}-${boldIndex}-${italicIndex}`} className="italic">
                {italicPart.slice(1, -1)}
              </em>
            );
          }

          return <span key={`${partIndex}-${boldIndex}-${italicIndex}`}>{italicPart}</span>;
        });
      });
    });
  };

  if (!hasHydratedChat) {
    return (
      <div className="mx-auto flex h-[calc(100vh-128px)] max-w-4xl flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-headline text-3xl font-medium tracking-tight text-primary italic">AI Assistant</h2>
              <p className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline/60">
                Restoring your saved sessions
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-2xl border border-outline-variant/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-outline/55">
            <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
            <span className="text-[12px] font-label font-bold uppercase tracking-[0.18em]">
              Loading memory
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-headline text-[44px] font-medium tracking-[-0.04em] text-primary italic">AI Assistant</h2>
              <p className="text-[10px] font-label font-bold uppercase tracking-[0.25em] text-outline/60">
                {activeProviderLabel} active • persistent memory and actionable planning
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-full border border-outline-variant/10 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-1">
                {(['gemini', 'mimo'] as AIProvider[]).map((provider) => {
                  const isActive = selectedAIProvider === provider;

                  return (
                    <button
                      key={provider}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSelectedAIProvider(provider)}
                      className={cn(
                        'rounded-full px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.16em] transition-all',
                        isActive
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-outline/55 hover:bg-primary/5 hover:text-primary',
                        isLoading && 'cursor-not-allowed opacity-70'
                      )}
                    >
                      {getAIProviderLabel(provider)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={historyRef} className="relative flex items-center gap-3">
              <button
                onClick={() => setIsHistoryOpen((current) => !current)}
                className="flex items-center gap-2 rounded-full border border-outline-variant/10 bg-white/70 px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-outline/60 transition-all hover:border-primary/15 hover:bg-primary/5 hover:text-primary"
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-full bg-white/40 px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-outline/60 transition-all hover:bg-primary/5 hover:text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Chat
              </button>

              {isHistoryOpen && (
                <ChatHistoryPanel
                  sessions={historySessions}
                  activeSessionId={activeSession?.id ?? null}
                  onSelectSession={(sessionId) => {
                    setActiveChatSession(sessionId);
                    setEditingMessageId(null);
                    setIsHistoryOpen(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="hide-scrollbar min-h-[620px] flex-1 overflow-y-auto rounded-[34px] border border-outline-variant/10 bg-white/80 shadow-[0_24px_72px_rgba(35,24,54,0.08)] backdrop-blur-xl">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center md:p-20">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="relative mb-8"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-2xl shadow-purple-500/30">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-400 to-indigo-500 opacity-20 blur-xl animate-pulse" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <h3 className="mb-4 font-headline text-[40px] font-medium italic tracking-[-0.04em] text-primary">
                  What do you want to move forward today?
                </h3>
                <p className="max-w-2xl text-[15px] leading-8 text-outline/60">
                  {activeProviderLabel} is ready with the same Task2Do-native context, task drafting flow, and approval-based actions. {activeProviderDescription}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-10 flex max-w-3xl flex-wrap justify-center gap-3"
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-primary/10 bg-white px-5 py-3 text-[13px] font-medium text-primary/75 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <div className={cn(
                      "max-w-[78%] rounded-[24px] px-6 py-4",
                      message.role === 'user'
                        ? "rounded-br-md bg-primary text-on-primary"
                        : "rounded-bl-md border border-outline-variant/10 bg-[#f6f1ff]"
                      )}>
                      {message.role === 'user' ? (
                        <p className="text-[14px] leading-relaxed">{message.content}</p>
                      ) : (
                        <div className="text-[14px] leading-relaxed text-on-surface">
                          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/45 shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {message.assistantLabel || 'Assistant'}
                          </div>
                          {message.content ? renderMarkdown(message.content) : null}
                          {message.proposal && (
                            <TaskProposalCard
                              proposal={message.proposal}
                              status={message.proposalStatus}
                              isSubmitting={submittingMessageId === message.id}
                              onApprove={() => handleApproveProposal(message)}
                              onEdit={() => setEditingMessageId(message.id)}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-4"
                >
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-outline-variant/10 bg-surface-container-low px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
                      <span className="text-[12px] font-label font-bold uppercase tracking-[0.1em] text-outline/50">
                        {activeProviderLabel} is thinking...
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-end gap-3 rounded-[28px] border border-outline-variant/10 bg-white/85 p-3 shadow-[0_18px_54px_rgba(35,24,54,0.08)] transition-all duration-300 focus-within:border-primary/20 focus-within:shadow-md">
            <div className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-600/10">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${activeProviderLabel} to plan, prioritize, or schedule something...`}
              rows={1}
              className="max-h-32 min-h-[44px] flex-1 resize-none border-none bg-transparent py-2 text-[15px] tracking-tight text-primary outline-none placeholder:text-outline/40"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                inputValue.trim() && !isLoading
                  ? "scale-100 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30"
                  : "cursor-not-allowed bg-outline-variant/10 text-outline/30"
              )}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-3 text-center text-[9px] font-label font-bold uppercase tracking-[0.2em] text-outline/30">
            {activeProviderLabel} • Shared Task2Do memory, polished replies, and approval-based actions
          </p>
        </div>
      </div>

      <ProposalEditorModal
        key={editingMessageId ?? 'proposal-editor-closed'}
        isOpen={!!editingMessage?.proposal}
        proposal={editingMessage?.proposal ?? null}
        lists={listOptions}
        isSubmitting={submittingMessageId === editingMessage?.id}
        onClose={() => setEditingMessageId(null)}
        onSubmit={handleSubmitEditedProposal}
      />
    </>
  );
}
