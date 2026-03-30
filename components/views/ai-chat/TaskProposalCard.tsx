'use client';

import type { ComponentType } from 'react';
import { format } from 'date-fns';
import { CalendarDays, CheckCircle2, Clock3, Flag, FolderClosed, PencilLine, Sparkles } from 'lucide-react';
import { TaskProposal, ProposalStatus } from '@/lib/ai/task2do-chat';
import { cn } from '@/lib/utils';

interface TaskProposalCardProps {
  proposal: TaskProposal;
  status?: ProposalStatus | null;
  isSubmitting?: boolean;
  onApprove: () => void;
  onEdit: () => void;
}

const priorityLabels: Record<number, string> = {
  0: 'No priority',
  1: 'Low priority',
  2: 'Medium priority',
  3: 'High priority',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending approval',
  approved: 'Saved to Task2Do',
  edited: 'Saved after edit',
};

export function TaskProposalCard({
  proposal,
  status = 'pending',
  isSubmitting = false,
  onApprove,
  onEdit,
}: TaskProposalCardProps) {
  const startDate = proposal.startDate ? new Date(proposal.startDate) : null;
  const dateLabel = startDate ? format(startDate, 'EEE, MMM d, yyyy') : 'No date set';
  const timeLabel = proposal.isAllDay
    ? 'All day'
    : startDate ? format(startDate, 'p') : 'No time set';
  const isComplete = status === 'approved' || status === 'edited';

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm shadow-primary/5">
      <div className="border-b border-primary/10 bg-gradient-to-r from-primary/[0.04] via-white to-indigo-500/[0.05] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              {isComplete ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5" />}
            </div>
            <div>
              <p className="text-[10px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">
                AI Task Proposal
              </p>
              <h4 className="mt-1 font-headline text-xl font-medium italic text-primary">
                {proposal.title}
              </h4>
            </div>
          </div>

          <span className={cn(
            "inline-flex rounded-full px-3 py-1 text-[9px] font-label font-bold uppercase tracking-[0.18em]",
            isComplete
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          )}>
            {statusLabels[status ?? 'pending']}
          </span>
        </div>

        {proposal.rationale && (
          <p className="mt-3 text-[12px] leading-relaxed text-outline/70">
            {proposal.rationale}
          </p>
        )}
      </div>

      <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
        <DetailRow icon={CalendarDays} label="Date" value={proposal.naturalLanguageWhen || dateLabel} />
        <DetailRow icon={Clock3} label="Time" value={timeLabel} />
        <DetailRow icon={FolderClosed} label="Collection" value={proposal.listName || 'Inbox'} />
        <DetailRow icon={Flag} label="Priority" value={priorityLabels[proposal.priority] || priorityLabels[0]} />
      </div>

      {proposal.description && (
        <div className="border-t border-primary/10 px-5 py-4">
          <p className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
            Notes
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-outline/70">
            {proposal.description}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-primary/10 px-5 py-4">
        <button
          onClick={onApprove}
          disabled={isSubmitting || isComplete}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.16em] transition-all",
            isSubmitting || isComplete
              ? "cursor-not-allowed bg-emerald-50 text-emerald-400"
              : "bg-primary text-on-primary shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20"
          )}
        >
          {isSubmitting ? 'Saving...' : isComplete ? 'Saved' : 'Approve'}
        </button>

        <button
          onClick={onEdit}
          disabled={isSubmitting || isComplete}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.16em] transition-all",
            isSubmitting || isComplete
              ? "cursor-not-allowed border-outline-variant/10 text-outline/30"
              : "border-primary/15 text-primary hover:bg-primary/5"
          )}
        >
          <PencilLine className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary/45" />
        <p className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/45">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[13px] font-medium text-primary/80">
        {value}
      </p>
    </div>
  );
}
