'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { ChatListContext, TaskProposal } from '@/lib/ai/task2do-chat';

interface ProposalEditorModalProps {
  isOpen: boolean;
  proposal: TaskProposal | null;
  lists: ChatListContext[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (proposal: TaskProposal) => void | Promise<void>;
}

const quadrantOptions = [
  { value: '', label: 'No matrix quadrant' },
  { value: 'urgent-important', label: 'Urgent & Important' },
  { value: 'not-urgent-important', label: 'Not Urgent & Important' },
  { value: 'urgent-not-important', label: 'Urgent & Not Important' },
  { value: 'not-urgent-not-important', label: 'Not Urgent & Not Important' },
];

function getDraftFromProposal(proposal: TaskProposal | null) {
  const nextStartDate = proposal?.startDate ? new Date(proposal.startDate) : null;
  const priority = proposal?.priority;

  return {
    title: proposal?.title || '',
    description: proposal?.description || '',
    listId: proposal?.listId || '',
    priority: (priority === 1 || priority === 2 || priority === 3 ? priority : 0) as 0 | 1 | 2 | 3,
    status: proposal?.status ?? 'todo' as 'todo' | 'in-progress' | 'done',
    quadrant: proposal?.quadrant || '',
    startDate: nextStartDate,
    endDate: proposal?.endDate ? new Date(proposal.endDate) : null,
    isAllDay: proposal?.isAllDay ?? false,
    timezone: proposal?.timezone || null,
    reminderAt: nextStartDate && proposal?.reminderOffsetMinutes !== null && proposal?.reminderOffsetMinutes !== undefined
      ? new Date(nextStartDate.getTime() - proposal.reminderOffsetMinutes * 60_000)
      : null,
  };
}

export function ProposalEditorModal({
  isOpen,
  proposal,
  lists,
  isSubmitting = false,
  onClose,
  onSubmit,
}: ProposalEditorModalProps) {
  const initialDraft = getDraftFromProposal(proposal);
  const [title, setTitle] = useState(initialDraft.title);
  const [description, setDescription] = useState(initialDraft.description);
  const [listId, setListId] = useState<string>(initialDraft.listId);
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(initialDraft.priority);
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>(initialDraft.status);
  const [quadrant, setQuadrant] = useState<string>(initialDraft.quadrant);
  const [startDate, setStartDate] = useState<Date | null>(initialDraft.startDate);
  const [endDate, setEndDate] = useState<Date | null>(initialDraft.endDate);
  const [isAllDay, setIsAllDay] = useState<boolean>(initialDraft.isAllDay);
  const [timezone, setTimezone] = useState<string | null>(initialDraft.timezone);
  const [reminderAt, setReminderAt] = useState<Date | null>(initialDraft.reminderAt);

  const selectedListName = useMemo(() => (
    lists.find((list) => list.id === listId)?.name || null
  ), [listId, lists]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!proposal || !title.trim()) {
      return;
    }

    const reminderOffsetMinutes = startDate && reminderAt
      ? Math.max(0, Math.round((startDate.getTime() - reminderAt.getTime()) / 60_000))
      : null;

    await onSubmit({
      ...proposal,
      title: title.trim(),
      description: description.trim() || null,
      listId: listId || null,
      listName: selectedListName,
      priority,
      status,
      quadrant: quadrant || null,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      isAllDay,
      timezone: timezone || null,
      reminderOffsetMinutes,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Refine Task Draft"
      contentClassName="max-w-3xl max-h-[88vh] overflow-y-auto hide-scrollbar"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title"
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Notes
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context or details"
              rows={3}
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Collection
            </span>
            <select
              value={listId}
              onChange={(event) => setListId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            >
              <option value="">Inbox</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'todo' | 'in-progress' | 'done')}
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Priority
            </span>
            <select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value) as 0 | 1 | 2 | 3)}
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            >
              <option value={0}>None</option>
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
              Matrix
            </span>
            <select
              value={quadrant}
              onChange={(event) => setQuadrant(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-[14px] text-primary outline-none transition-all focus:border-primary/20 focus:shadow-sm"
            >
              {quadrantOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-3xl border border-outline-variant/10 bg-primary/[0.02] px-5 py-5">
          <p className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
            Date & Time
          </p>
          <div className="mt-4">
            <DateTimePicker
              startDate={startDate}
              endDate={endDate}
              isAllDay={isAllDay}
              timezone={timezone}
              reminderAt={reminderAt}
              onChange={(updates) => {
                setStartDate(updates.startDate);
                setEndDate(updates.endDate);
                setIsAllDay(Boolean(updates.isAllDay));
                setTimezone(updates.timezone);
                setReminderAt(updates.reminderAt);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-outline-variant/10 px-5 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/55 transition-all hover:bg-primary/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-on-primary shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save & Approve'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
