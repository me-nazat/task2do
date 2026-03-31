import { NextRequest, NextResponse } from 'next/server';
import {
  AIProvider,
  PocketTrackerActionProposal,
  PocketTrackerChatApiResponse,
  PocketTrackerChatMessage,
  POCKET_TRACKER_ACTION_TOOL_NAME,
  POCKET_TRACKER_CHAT_TOOLS,
  buildPocketTrackerContext,
  buildPocketTrackerSystemPrompt,
  getAIProviderLabel,
  isAIProvider,
} from '@/lib/ai/pocket-tracker-chat';
import type { FinanceBudget, FinanceTransaction } from '@/lib/finance/mock-data';

type ConversationMessage = Pick<PocketTrackerChatMessage, 'role' | 'content' | 'proposal' | 'proposalStatus'>;

type ChatRequestBody = {
  messages: ConversationMessage[];
  transactions?: FinanceTransaction[];
  budgets?: FinanceBudget[];
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
          temperature: 0.35,
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
        temperature: 0.35,
        max_tokens: 1800,
      },
      extraHeaders: {
        'HTTP-Referer': 'https://pockettracker.app',
        'X-Title': 'Pocket Tracker AI',
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
      temperature: 0.35,
      max_tokens: 1800,
    },
    extraHeaders: {
      'HTTP-Referer': 'https://pockettracker.app',
      'X-Title': 'Pocket Tracker AI',
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

function normalizePocketTrackerProposal(rawProposal: any): PocketTrackerActionProposal | null {
  if (!rawProposal || typeof rawProposal !== 'object') {
    return null;
  }

  const action = rawProposal.action;
  if (![
    'create-transaction',
    'update-transaction',
    'delete-transaction',
    'create-budget',
    'update-budget',
    'delete-budget',
  ].includes(action)) {
    return null;
  }

  return {
    action,
    targetId: typeof rawProposal.targetId === 'string' ? rawProposal.targetId : null,
    title: typeof rawProposal.title === 'string' ? rawProposal.title : null,
    category: typeof rawProposal.category === 'string' ? rawProposal.category : null,
    type: rawProposal.type === 'expense' || rawProposal.type === 'earning' ? rawProposal.type : null,
    date: typeof rawProposal.date === 'string' ? rawProposal.date : null,
    amount: typeof rawProposal.amount === 'number' ? rawProposal.amount : null,
    limit: typeof rawProposal.limit === 'number' ? rawProposal.limit : null,
    periodLabel: typeof rawProposal.periodLabel === 'string' ? rawProposal.periodLabel : null,
    rationale: typeof rawProposal.rationale === 'string' ? rawProposal.rationale : null,
    summary: typeof rawProposal.summary === 'string' ? rawProposal.summary : null,
  };
}

function buildFallbackMessage(proposal: PocketTrackerActionProposal) {
  switch (proposal.action) {
    case 'create-transaction':
      return `I drafted a new ${proposal.type || 'transaction'} entry for **${proposal.title || 'your request'}**. Review it below, edit anything you want, and then approve it.`;
    case 'update-transaction':
      return `I found the matching transaction and prepared the update. Review the draft below, make any edits, and then approve it.`;
    case 'delete-transaction':
      return `I prepared a deletion request for the selected transaction. Review it below before approving.`;
    case 'create-budget':
      return `I drafted a new budget for **${proposal.category || 'that category'}**. Review and approve it below.`;
    case 'update-budget':
      return `I prepared the budget update you asked for. Review and approve it below.`;
    case 'delete-budget':
      return `I prepared a deletion request for the selected budget. Review it below before approving.`;
    default:
      return 'I prepared an action for Pocket Tracker. Review it below and approve it when ready.';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const provider = isAIProvider(body.provider) ? body.provider : 'gemini';
    const providerConfig = buildProviderConfig(provider);
    const contextualPrompt = buildPocketTrackerContext(body.transactions || [], body.budgets || []);
    const systemPrompt = buildPocketTrackerSystemPrompt(provider);

    const conversation = (body.messages || []).map((message) => ({
      role: message.role,
      content: message.content || ' ',
    }));

    const response = await callChatProvider(providerConfig, {
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${contextualPrompt}` },
        ...conversation,
      ],
      tools: POCKET_TRACKER_CHAT_TOOLS,
      tool_choice: 'auto',
    });

    const choice = response.choices?.[0]?.message;
    const content = normalizeTextContent(choice?.content);
    const toolCall = choice?.tool_calls?.find(
      (call: any) => call?.function?.name === POCKET_TRACKER_ACTION_TOOL_NAME
    );
    const proposal = toolCall
      ? normalizePocketTrackerProposal(JSON.parse(toolCall.function.arguments || '{}'))
      : null;

    const payload: PocketTrackerChatApiResponse = {
      message: content || (proposal ? buildFallbackMessage(proposal) : 'Pocket Tracker AI is ready to help.'),
      provider,
      providerLabel: getAIProviderLabel(provider),
      proposal,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Pocket Tracker chat error:', error);
    return NextResponse.json(
      {
        message: 'Pocket Tracker AI hit a temporary issue. Please try again in a moment.',
      },
      { status: 500 }
    );
  }
}
