import { NextRequest, NextResponse } from 'next/server';
import {
  AIProvider,
  ChatListContext,
  ChatTaskContext,
  DEFAULT_AI_PROVIDER,
  TASK2DO_CHAT_TOOLS,
  TASK_PROPOSAL_TOOL_NAME,
  TaskProposal,
  buildTask2DoChatSystemPrompt,
  getAIProviderLabel,
  isAIProvider,
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
  provider?: AIProvider;
};

type ProviderConfig = {
  provider: AIProvider;
  label: string;
  apiKey: string;
  endpoint: string;
  model: string;
  defaultBody: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
};

const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'google/gemini-2.0-flash-001';
const DEFAULT_MIMO_OPENROUTER_MODEL = process.env.MIMO_OPENROUTER_MODEL?.trim() || 'xiaomi/mimo-v2-flash';
const DEFAULT_MIMO_DIRECT_MODEL = process.env.MIMO_MODEL?.trim() || DEFAULT_MIMO_OPENROUTER_MODEL;

function buildProviderConfig(provider: AIProvider): ProviderConfig {
  if (provider === 'mimo') {
    const directEndpoint = process.env.MIMO_API_BASE_URL?.trim();
    const directApiKey = process.env.MIMO_API_KEY?.trim();

    if (directEndpoint && directApiKey) {
      return {
        provider,
        label: getAIProviderLabel(provider),
        apiKey: directApiKey,
        endpoint: directEndpoint,
        model: DEFAULT_MIMO_DIRECT_MODEL,
        defaultBody: {
          temperature: 0.45,
          max_tokens: 1800,
        },
      };
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured for MiMo fallback');
    }

    return {
      provider,
      label: getAIProviderLabel(provider),
      apiKey: openRouterKey,
      endpoint: OPENROUTER_CHAT_ENDPOINT,
      model: DEFAULT_MIMO_OPENROUTER_MODEL,
      defaultBody: {
        temperature: 0.45,
        max_tokens: 1800,
      },
      extraHeaders: {
        'HTTP-Referer': 'https://task2do.app',
        'X-Title': 'Task2Do AI Assistant',
      },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  return {
    provider: 'gemini',
    label: getAIProviderLabel('gemini'),
    apiKey,
    endpoint: OPENROUTER_CHAT_ENDPOINT,
    model: DEFAULT_GEMINI_MODEL,
    defaultBody: {
      temperature: 0.45,
      max_tokens: 1800,
    },
    extraHeaders: {
      'HTTP-Referer': 'https://task2do.app',
      'X-Title': 'Task2Do AI Assistant',
    },
  };
}

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

  return `Current context:
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

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findLatestUserMessage(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages[index];
    }
  }

  return null;
}

function isLikelyTaskCreationRequest(messages: ConversationMessage[]) {
  const latestUserMessage = findLatestUserMessage(messages)?.content?.toLowerCase() || '';

  if (!latestUserMessage) {
    return false;
  }

  const actionVerbPattern = /\b(schedule|add|create|plan|book|set up|put|draft|remind me|block time|time-block|make a task|create a task)\b/i;
  const timeSignalPattern = /\b(today|tomorrow|tonight|next|this|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s?(am|pm))\b/i;

  return actionVerbPattern.test(latestUserMessage) || timeSignalPattern.test(latestUserMessage);
}

function parseRequestedLocalTime(messages: ConversationMessage[]) {
  const latestUserMessage = findLatestUserMessage(messages)?.content || '';
  const meridiemMatch = latestUserMessage.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1]) % 12;
    const minute = Number(meridiemMatch[2] || '0');
    const meridiem = meridiemMatch[3].toLowerCase();

    if (meridiem === 'pm') {
      hour += 12;
    }

    return { hour, minute };
  }

  const twentyFourHourMatch = latestUserMessage.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHourMatch) {
    return {
      hour: Number(twentyFourHourMatch[1]),
      minute: Number(twentyFourHourMatch[2]),
    };
  }

  return null;
}

function getTimeZoneOffsetString(timeZone: string, referenceDate: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeZonePart = formatter.formatToParts(new Date(referenceDate)).find((part) => part.type === 'timeZoneName')?.value;
  const match = timeZonePart?.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);

  if (!match) {
    return 'Z';
  }

  const rawHours = Number(match[1]);
  const sign = rawHours >= 0 ? '+' : '-';
  const hours = String(Math.abs(rawHours)).padStart(2, '0');
  const minutes = String(Number(match[2] || '0')).padStart(2, '0');

  return `${sign}${hours}:${minutes}`;
}

function reinterpretIsoAsLocalClock(dateString: string, timeZone: string) {
  const match = dateString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/);

  if (!match) {
    return dateString;
  }

  const offset = getTimeZoneOffsetString(timeZone, dateString);
  return `${match[1]}T${match[2]}${offset}`;
}

function getLocalTimeParts(dateString: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(dateString));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');

  return { hour, minute };
}

function formatProposalWhen(proposal: TaskProposal) {
  if (!proposal.startDate) {
    return proposal.naturalLanguageWhen || null;
  }

  try {
    const timeZone = proposal.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', proposal.isAllDay ? {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    } : {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return formatter.format(new Date(proposal.startDate));
  } catch {
    return proposal.naturalLanguageWhen || null;
  }
}

function stabilizeProposal(
  proposal: TaskProposal,
  messages: ConversationMessage[],
  fallbackTimeZone?: string
) {
  const resolvedTimeZone = proposal.timezone || fallbackTimeZone || null;
  const requestedTime = parseRequestedLocalTime(messages);
  let startDate = proposal.startDate;
  let endDate = proposal.endDate;

  if (resolvedTimeZone && requestedTime && startDate && /Z$/i.test(startDate)) {
    const actualLocalTime = getLocalTimeParts(startDate, resolvedTimeZone);

    if (actualLocalTime.hour !== requestedTime.hour || actualLocalTime.minute !== requestedTime.minute) {
      startDate = reinterpretIsoAsLocalClock(startDate, resolvedTimeZone);

      if (endDate) {
        endDate = reinterpretIsoAsLocalClock(endDate, resolvedTimeZone);
      }
    }
  }

  const stabilizedProposal: TaskProposal = {
    ...proposal,
    startDate,
    endDate,
    timezone: resolvedTimeZone,
  };

  return {
    ...stabilizedProposal,
    naturalLanguageWhen: stabilizedProposal.naturalLanguageWhen || formatProposalWhen(stabilizedProposal),
  };
}

async function attemptProposalExtraction(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  contextualPrompt: string,
  conversation: ReturnType<typeof formatConversation>
) {
  const extractionResponse = await callChatProvider(providerConfig, {
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}

${contextualPrompt}

You are recovering from a failed tool call. Convert the user's latest actionable scheduling or task-creation request into a Task2Do task proposal.

Return only a single JSON object.
- Do not wrap the JSON in prose unless absolutely necessary.
- Prefer status "todo" when unsure.
- Prefer priority 0 when unsure.
- Use null for unknown optional fields.
- If the user specified a start time but not an end time, you may infer a sensible one-hour duration.
- Keep the title clean and concise.
- Use ISO-8601 strings for startDate and endDate.
- Use one of: todo, in-progress, done for status.
- Use one of: 0, 1, 2, 3 for priority.`,
      },
      ...conversation,
    ],
  });

  const extractionText = normalizeTextContent(extractionResponse.choices?.[0]?.message?.content);
  const jsonText = extractJsonObject(extractionText);
  const parsed = parseJsonSafely(jsonText);

  return normalizeProposal(parsed);
}

async function callChatProvider(config: ProviderConfig, body: Record<string, unknown>) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: config.model,
      ...config.defaultBody,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.label} API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function buildFallbackProposalMessage(proposal: TaskProposal) {
  const when = proposal.naturalLanguageWhen || 'the requested time';
  return `**Draft ready.** I prepared **${proposal.title}** for **${when}**. Review the proposal card below, then approve it or edit any detail before saving.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, tasks, lists, now, timezone, provider: rawProvider } = await request.json() as ChatRequestBody;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const provider = isAIProvider(rawProvider) ? rawProvider : DEFAULT_AI_PROVIDER;
    const providerConfig = buildProviderConfig(provider);
    const contextualPrompt = buildContextualPrompt({ tasks, lists, now, timezone });
    const conversation = formatConversation(messages);
    const systemPrompt = buildTask2DoChatSystemPrompt(provider);

    const initialResponse = await callChatProvider(providerConfig, {
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${contextualPrompt}` },
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
    const parsedArguments = toolCall ? parseJsonSafely(toolCall.function?.arguments || '{}') : null;
    const proposalFromToolCall = normalizeProposal(parsedArguments);

    let proposal = proposalFromToolCall;

    if (!proposal) {
      if (isLikelyTaskCreationRequest(messages)) {
        try {
          proposal = await attemptProposalExtraction(
            providerConfig,
            systemPrompt,
            contextualPrompt,
            conversation
          );
        } catch (extractionError) {
          console.error('Chat proposal extraction error:', extractionError);
        }
      }

      if (!proposal) {
        return NextResponse.json({
          message: assistantText || 'I understood the request, but I could not prepare a reliable task draft yet. Please try rephrasing it.',
          provider,
          providerLabel: providerConfig.label,
        });
      }
    }

    proposal = stabilizeProposal(proposal, messages, timezone);

    if (!toolCall) {
      return NextResponse.json({
        message: buildFallbackProposalMessage(proposal),
        provider,
        providerLabel: providerConfig.label,
        proposal,
      });
    }

    return NextResponse.json({
      message: buildFallbackProposalMessage(proposal),
      provider,
      providerLabel: providerConfig.label,
      proposal,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
