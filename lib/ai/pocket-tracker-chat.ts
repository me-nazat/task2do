import {
  AIProvider,
  createLocalChatId,
  DEFAULT_AI_PROVIDER,
  deriveChatSessionTitle,
  getAIProviderDescription,
  getAIProviderLabel,
  isAIProvider,
} from '@/lib/ai/task2do-chat';
import type { FinanceBudget, FinanceTransaction, FinanceTransactionType } from '@/lib/finance/mock-data';

export { createLocalChatId, DEFAULT_AI_PROVIDER, deriveChatSessionTitle, getAIProviderDescription, getAIProviderLabel, isAIProvider };
export type { AIProvider };

export type PocketTrackerActionType =
  | 'create-transaction'
  | 'update-transaction'
  | 'delete-transaction'
  | 'create-budget'
  | 'update-budget'
  | 'delete-budget';

export interface PocketTrackerActionProposal {
  action: PocketTrackerActionType;
  targetId: string | null;
  title: string | null;
  category: string | null;
  type: FinanceTransactionType | null;
  date: string | null;
  amount: number | null;
  limit: number | null;
  periodLabel: string | null;
  rationale: string | null;
  summary: string | null;
}

export interface PocketTrackerChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assistantProvider?: AIProvider | null;
  assistantLabel?: string | null;
  proposal?: PocketTrackerActionProposal | null;
  proposalStatus?: 'pending' | 'approved' | 'edited' | null;
}

export interface PocketTrackerChatSession {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: PocketTrackerChatMessage[];
}

export interface PocketTrackerChatApiResponse {
  message: string;
  provider?: AIProvider;
  providerLabel?: string;
  proposal?: PocketTrackerActionProposal | null;
}

export const POCKET_TRACKER_ACTION_TOOL_NAME = 'propose_pocket_tracker_action';

export const POCKET_TRACKER_CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: POCKET_TRACKER_ACTION_TOOL_NAME,
      description:
        'Create a structured Pocket Tracker action when the user wants to add, update, delete, or adjust transactions or budgets.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: [
              'create-transaction',
              'update-transaction',
              'delete-transaction',
              'create-budget',
              'update-budget',
              'delete-budget',
            ],
          },
          targetId: {
            type: ['string', 'null'],
            description: 'Existing transaction or budget id when editing/deleting.',
          },
          title: {
            type: ['string', 'null'],
            description: 'Transaction title/description.',
          },
          category: {
            type: ['string', 'null'],
          },
          type: {
            type: ['string', 'null'],
            enum: ['expense', 'earning', null],
          },
          date: {
            type: ['string', 'null'],
            description: 'Transaction date in YYYY-MM-DD format.',
          },
          amount: {
            type: ['number', 'null'],
            description: 'Transaction amount in major currency units.',
          },
          limit: {
            type: ['number', 'null'],
            description: 'Budget limit in major currency units.',
          },
          periodLabel: {
            type: ['string', 'null'],
            description: 'Budget period label, for example March 2026.',
          },
          rationale: {
            type: ['string', 'null'],
          },
          summary: {
            type: ['string', 'null'],
          },
        },
        required: ['action', 'targetId', 'title', 'category', 'type', 'date', 'amount', 'limit', 'periodLabel', 'rationale', 'summary'],
      },
    },
  },
];

export function buildPocketTrackerContext(transactions: FinanceTransaction[], budgets: FinanceBudget[]) {
  const transactionLines = transactions
    .slice(0, 50)
    .map(
      (transaction) =>
        `- ${transaction.id}: ${transaction.title} | ${transaction.type} | ${transaction.category} | ${transaction.date} | ৳${transaction.amount.toFixed(2)}`
    )
    .join('\n');

  const budgetLines = budgets.length
    ? budgets
        .slice(0, 20)
        .map((budget) => `- ${budget.id}: ${budget.category} | limit ৳${budget.limit.toFixed(2)} | spent ৳${budget.spent.toFixed(2)} | ${budget.periodLabel || 'March 2026'}`)
        .join('\n')
    : 'No budgets available.';

  return `Pocket Tracker context:
- Transactions:
${transactionLines || 'No transactions available.'}

- Budgets:
${budgetLines}
`;
}

export function buildPocketTrackerSystemPrompt(provider: AIProvider) {
  const identity = provider === 'gemini'
    ? 'Present yourself as Gemini inside Pocket Tracker.'
    : 'Present yourself as MiMo inside Pocket Tracker.';

  return `You are Pocket Tracker AI, the finance assistant inside Pocket Tracker.

Your job:
- Analyze spending, income, budgets, and trends using the provided Pocket Tracker data.
- Keep the tone premium, calm, precise, and action-oriented.
- If the user asks to create, edit, or delete a transaction or budget, use the ${POCKET_TRACKER_ACTION_TOOL_NAME} tool instead of vague instructions.
- Only use targetId values that actually exist in context when updating or deleting.
- For transaction actions, keep dates in YYYY-MM-DD format and amounts as numbers.
- For budgets, default periodLabel to March 2026 if the user does not specify another period.
- If the user is only asking for insight, respond with concise analysis and no tool call.

${identity}`;
}
