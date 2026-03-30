import { NextRequest, NextResponse } from 'next/server';
import {
  ChatListContext,
  ChatTaskContext,
  TASK2DO_CHAT_SYSTEM_PROMPT,
  TASK2DO_CHAT_TOOLS,
  TASK_PROPOSAL_TOOL_NAME,
  TaskProposal,
} from '@/lib/ai/task2do-chat';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  proposal?: TaskProposal | null;
  proposalStatus?: string | null;
};

type ChatRequestBody = {
  messages: ConversationMessage[];
  tasks?: ChatTaskContext[];
  lists?: ChatListContext[];
  now?: string;
  timezone?: string;
};

function normalizeTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object' && 'text' in content && typeof content.text === 'string') {
    return content.text;
  }

  return '';
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatConversation(messages: ConversationMessage[]) {
  return messages.map((message) => {
    const parts = [message.content?.trim()].filter(Boolean);

    if (message.proposal) {
      parts.push(
        `Structured task proposal already in this conversation:\n${JSON.stringify({
          proposalStatus: message.proposalStatus || 'pending',
          proposal: message.proposal,
        }, null, 2)}`
      );
    }

    return {
      role: message.role,
      content: parts.join('\n\n') || ' ',
    };
  });
}

function buildContextualPrompt({
  tasks = [],
  lists = [],
  now,
  timezone,
}: {
  tasks?: ChatTaskContext[];
  lists?: ChatListContext[];
  now?: string;
  timezone?: string;
}) {
  const listMap = new Map(lists.map((list) => [list.id, list.name]));
  const currentTimeLabel = now ? new Date(now).toISOString() : new Date().toISOString();

  const taskSummary = tasks
    .filter((task) => !task.parentId)
    .slice(0, 60)
    .map((task) => {
      const parts = [`• "${task.title}"`];

      if (task.status) parts.push(`[${task.status}]`);
      if (task.priority && task.priority > 0) {
        const priorityLabels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
        parts.push(`Priority: ${priorityLabels[task.priority] || 'None'}`);
      }

      const startDate = toIsoString(task.startDate);
      if (startDate) {
        parts.push(`Starts: ${startDate}`);
      }

      const listName = task.listId ? listMap.get(task.listId) : null;
      if (listName) {
        parts.push(`Collection: ${listName}`);
      }

      if (task.isCompleted) parts.push('Completed');
      if (task.quadrant) parts.push(`Quadrant: ${task.quadrant}`);
      if (task.recurrence) parts.push(`Recurs: ${task.recurrence}`);

      return parts.join(' — ');
    })
    .join('\n');

  const listSummary = lists.length > 0
    ? lists
        .slice(0, 30)
        .map((list) => `- ${list.name} (id: ${list.id})`)
        .join('\n')
    : 'No custom collections are currently available.';

  return `${TASK2DO_CHAT_SYSTEM_PROMPT}

Current context:
- Current datetime: ${currentTimeLabel}
- Active timezone: ${timezone || 'UTC'}

Available collections:
${listSummary}

Current tasks:
${taskSummary || 'No tasks available in context.'}`;
}

function normalizeProposal(rawProposal: any): TaskProposal | null {
  if (!rawProposal || typeof rawProposal !== 'object') {
    return null;
  }

  const title = typeof rawProposal.title === 'string' ? rawProposal.title.trim() : '';
  if (!title) {
    return null;
  }

  const priority = [0, 1, 2, 3].includes(rawProposal.priority) ? rawProposal.priority : 0;
  const status = ['todo', 'in-progress', 'done'].includes(rawProposal.status) ? rawProposal.status : 'todo';
  const quadrant = [
    'urgent-important',
    'not-urgent-important',
    'urgent-not-important',
    'not-urgent-not-important',
  ].includes(rawProposal.quadrant) ? rawProposal.quadrant : null;

  return {
    action: 'create-task',
    title,
    description: typeof rawProposal.description === 'string' ? rawProposal.description : null,
    startDate: typeof rawProposal.startDate === 'string' ? rawProposal.startDate : null,
    endDate: typeof rawProposal.endDate === 'string' ? rawProposal.endDate : null,
    isAllDay: Boolean(rawProposal.isAllDay),
    timezone: typeof rawProposal.timezone === 'string' ? rawProposal.timezone : null,
    reminderOffsetMinutes: Number.isInteger(rawProposal.reminderOffsetMinutes) ? rawProposal.reminderOffsetMinutes : null,
    priority,
    status,
    quadrant,
    listId: typeof rawProposal.listId === 'string' ? rawProposal.listId : null,
    listName: typeof rawProposal.listName === 'string' ? rawProposal.listName : null,
    recurrence: typeof rawProposal.recurrence === 'string' ? rawProposal.recurrence : null,
    naturalLanguageWhen: typeof rawProposal.naturalLanguageWhen === 'string' ? rawProposal.naturalLanguageWhen : null,
    rationale: typeof rawProposal.rationale === 'string' ? rawProposal.rationale : null,
  };
}

async function callOpenRouter(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://task2do.app',
      'X-Title': 'Task2Do AI Assistant',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      temperature: 0.45,
      max_tokens: 1800,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function buildFallbackProposalMessage(proposal: TaskProposal) {
  const when = proposal.naturalLanguageWhen || 'the requested time';
  return `**Draft ready.** I prepared **${proposal.title}** for **${when}**. Review the proposal card below, then approve it or edit any detail before saving.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, tasks, lists, now, timezone } = await request.json() as ChatRequestBody;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const contextualPrompt = buildContextualPrompt({ tasks, lists, now, timezone });
    const conversation = formatConversation(messages);

    const initialResponse = await callOpenRouter(apiKey, {
      messages: [
        { role: 'system', content: contextualPrompt },
        ...conversation,
      ],
      tools: TASK2DO_CHAT_TOOLS,
      tool_choice: 'auto',
    });

    const assistantMessage = initialResponse.choices?.[0]?.message;
    const assistantText = normalizeTextContent(assistantMessage?.content);
    const toolCall = assistantMessage?.tool_calls?.find(
      (call: any) => call?.function?.name === TASK_PROPOSAL_TOOL_NAME
    );

    if (!toolCall) {
      return NextResponse.json({
        message: assistantText || 'I apologize, but I was unable to generate a response. Please try again.',
      });
    }

    const parsedArguments = JSON.parse(toolCall.function?.arguments || '{}');
    const proposal = normalizeProposal(parsedArguments);

    if (!proposal) {
      return NextResponse.json({
        message: assistantText || 'I understood the request, but I could not prepare a reliable task draft yet. Please try rephrasing it.',
      });
    }

    try {
      const followUpResponse = await callOpenRouter(apiKey, {
        messages: [
          { role: 'system', content: contextualPrompt },
          ...conversation,
          {
            role: 'assistant',
            content: assistantMessage?.content ?? '',
            tool_calls: assistantMessage?.tool_calls,
          },
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              ok: true,
              action: 'proposal-ready',
              note: 'The proposal will be rendered in the Task2Do UI for approval or editing before any database write happens.',
              proposal,
            }),
          },
        ],
        tool_choice: 'none',
      });

      const followUpText = normalizeTextContent(followUpResponse.choices?.[0]?.message?.content);

      return NextResponse.json({
        message: followUpText || buildFallbackProposalMessage(proposal),
        proposal,
      });
    } catch (followUpError) {
      console.error('Chat follow-up formatting error:', followUpError);

      return NextResponse.json({
        message: buildFallbackProposalMessage(proposal),
        proposal,
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
