export type ChatRole = 'user' | 'assistant';
export type ProposalStatus = 'pending' | 'approved' | 'edited';
export type AIProvider = 'gemini' | 'mimo';

export interface AIProviderOption {
  id: AIProvider;
  label: string;
  description: string;
}

export const DEFAULT_AI_PROVIDER: AIProvider = 'gemini';

export const AI_PROVIDER_OPTIONS: AIProviderOption[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Balanced planning and scheduling guidance inside Task2Do.',
  },
  {
    id: 'mimo',
    label: 'MiMo',
    description: 'Task2Do-native planning with the same approval-based workflow.',
  },
] as const;

export interface TaskProposal {
  action: 'create-task';
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isAllDay: boolean;
  timezone: string | null;
  reminderOffsetMinutes: number | null;
  priority: 0 | 1 | 2 | 3;
  status: 'todo' | 'in-progress' | 'done';
  quadrant: string | null;
  listId: string | null;
  listName: string | null;
  recurrence: string | null;
  naturalLanguageWhen: string | null;
  rationale: string | null;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  assistantProvider?: AIProvider | null;
  assistantLabel?: string | null;
  proposal?: TaskProposal | null;
  proposalStatus?: ProposalStatus | null;
  proposalTaskId?: string | null;
}

export interface ChatSession {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatTaskContext {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: number | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isCompleted?: boolean | null;
  quadrant?: string | null;
  listId?: string | null;
  parentId?: string | null;
  recurrence?: string | null;
}

export interface ChatListContext {
  id: string;
  name: string;
  color: string | null;
}

export interface ChatApiResponse {
  message: string;
  provider?: AIProvider;
  providerLabel?: string;
  proposal?: TaskProposal | null;
}

export const TASK_PROPOSAL_TOOL_NAME = 'propose_task_creation';
export const DEFAULT_CHAT_TITLE = 'New chat';

export function isAIProvider(value: unknown): value is AIProvider {
  return value === 'gemini' || value === 'mimo';
}

export function getAIProviderLabel(provider: AIProvider) {
  return AI_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ?? 'AI';
}

export function getAIProviderDescription(provider: AIProvider) {
  return AI_PROVIDER_OPTIONS.find((option) => option.id === provider)?.description ?? 'Task2Do AI assistant.';
}

export function createLocalChatId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return `${prefix}-${random}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveChatSessionTitle(messages: Array<Pick<ChatMessage, 'role' | 'content'>>) {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());

  if (!firstUserMessage) {
    return DEFAULT_CHAT_TITLE;
  }

  return firstUserMessage.content.trim().replace(/\s+/g, ' ').slice(0, 48);
}

const TASK2DO_CHAT_SYSTEM_PROMPT_BASE = `You are Task2Do AI, the deeply integrated assistant inside the Task2Do productivity app.

Your persona:
- Deeply knowledgeable about productivity systems, planning, prioritization, scheduling, and calm execution.
- Polite, precise, and hyper-efficient.
- Native to Task2Do: every response should feel aware of the app's views, lists, dates, and scheduling workflows.

How to respond:
- Write beautifully formatted answers using short paragraphs, **bold highlights**, and clean bullet or numbered lists when helpful.
- Keep spacing clean and easy to scan.
- Give concrete, contextual guidance instead of generic advice.
- Reference Task2Do concepts naturally when useful: Inbox, Today, Upcoming, Schedule, Kanban, Matrix, Habits, and Collections.
- Stay concise unless the user asks for a deeper plan.

Action policy:
- If the user is asking to create or schedule a task, do not provide manual instructions.
- Use the \`${TASK_PROPOSAL_TOOL_NAME}\` tool to return a structured proposal for the UI.
- Only ask a clarifying question if a required detail is genuinely missing and cannot be reasonably inferred.
- When a date is relative or natural language like "Sunday at 4pm", interpret it using the provided current date and timezone, then convert it into exact ISO values when possible.
- If a list or collection is mentioned, only use a provided list id if it matches the available lists in context.
- The tool proposal should be clean, minimal, and ready for approval or editing.

Task defaults:
- Prefer status \`todo\` unless the user clearly requests something else.
- Prefer priority \`2\` only when the user signals real urgency or importance; otherwise use \`0\`.
- Leave optional fields null instead of inventing details.

Brand voice:
- Premium, calm, elegant, and trustworthy.
- Never sound robotic, cluttered, or verbose.`;

export function buildTask2DoChatSystemPrompt(provider: AIProvider) {
  const identityBlock = provider === 'gemini'
    ? `Provider identity:
- Present yourself simply as Gemini inside Task2Do.
- Do not reveal or confirm the exact underlying Gemini model name, version string, API vendor route, or deployment identifier.
- If asked for the exact Gemini model, reply that you are Gemini in Task2Do and move the conversation back to the user's work.`
    : `Provider identity:
- Present yourself simply as MiMo inside Task2Do.
- Match the same high-quality planning, scheduling, and task proposal behavior as Gemini.
- Keep the focus on helping the user move work forward inside Task2Do.`;

  return `${TASK2DO_CHAT_SYSTEM_PROMPT_BASE}

${identityBlock}`;
}

export const TASK2DO_CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: TASK_PROPOSAL_TOOL_NAME,
      description:
        'Create a structured task proposal for Task2Do when the user wants to schedule, add, or create a task. This proposal will be shown in the UI for approval or editing before the app writes anything to the database.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: {
            type: 'string',
            description: 'The clean task title that should appear in Task2Do.',
          },
          description: {
            type: ['string', 'null'],
            description: 'Optional notes or supporting description for the task.',
          },
          startDate: {
            type: ['string', 'null'],
            description: 'ISO-8601 datetime for when the task starts, or null if unscheduled.',
          },
          endDate: {
            type: ['string', 'null'],
            description: 'ISO-8601 datetime for when the task ends, or null if not applicable.',
          },
          isAllDay: {
            type: 'boolean',
            description: 'Whether the task should be treated as an all-day item.',
          },
          timezone: {
            type: ['string', 'null'],
            description: 'IANA timezone, for example America/New_York.',
          },
          reminderOffsetMinutes: {
            type: ['integer', 'null'],
            description: 'How many minutes before startDate the reminder should fire. Use null for no reminder.',
          },
          priority: {
            type: 'integer',
            enum: [0, 1, 2, 3],
            description: 'Task priority: 0 none, 1 low, 2 medium, 3 high.',
          },
          status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'done'],
            description: 'Workflow state for the task.',
          },
          quadrant: {
            type: ['string', 'null'],
            enum: [
              'urgent-important',
              'not-urgent-important',
              'urgent-not-important',
              'not-urgent-not-important',
              null,
            ],
            description: 'Optional Eisenhower matrix quadrant.',
          },
          listId: {
            type: ['string', 'null'],
            description: 'A matching Task2Do collection/list id from the provided context, or null.',
          },
          listName: {
            type: ['string', 'null'],
            description: 'The human-friendly collection/list name for display in the proposal card.',
          },
          recurrence: {
            type: ['string', 'null'],
            description: 'Optional recurrence rule string such as daily or weekly:1,3,5.',
          },
          naturalLanguageWhen: {
            type: ['string', 'null'],
            description: 'A short human-readable explanation of the interpreted date, for example "Next Sunday at 4:00 PM".',
          },
          rationale: {
            type: ['string', 'null'],
            description: 'A short explanation of any inference made, such as how an ambiguous date was resolved.',
          },
        },
        required: ['title', 'startDate', 'endDate', 'isAllDay', 'timezone', 'priority', 'status'],
      },
    },
  },
] as const;
