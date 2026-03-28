import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are the embedded AI assistant for "Task2Do", a premium productivity and task management application. Your name is Task2Do AI.

Your role is to help users organize their life, answer questions about their tasks, and manage their schedule effectively. You are deeply integrated into the Task2Do ecosystem and understand all of its concepts:

**Application Features You Understand:**
- **Inbox**: The default landing view where uncategorized tasks live. Users can filter by Day, Week, Month, or All Tasks.
- **Today**: Shows tasks scheduled for the current day.
- **Upcoming**: Shows tasks scheduled for future dates.
- **Someday**: A parking lot for tasks without urgency.
- **Schedule (Calendar)**: A monthly calendar view where users can see and create tasks on specific dates.
- **Progress (Kanban Board)**: A board with three columns — To Do, In Progress, and Done — for tracking task workflows. Users can filter the To Do column by Today's Tasks, Weekly Tasks, or All Tasks.
- **Matrix (Eisenhower)**: A 2x2 priority matrix with quadrants: Urgent & Important, Not Urgent & Important, Urgent & Not Important, Not Urgent & Not Important.
- **Habits**: A habit tracking view for recurring behaviors.
- **Collections**: Custom user-created lists/folders for organizing tasks by project or category.

**Task Properties You Know About:**
- Title, Description (rich text notes)
- Start Date, End Date, All Day toggle
- Time zone setting
- Reminder notifications (with configurable offsets like 5min, 30min, 1 hour, 1 day before)
- Priority levels: None, Low, Medium, High
- Status: To Do, In Progress, Done
- Quadrant assignment (for the Eisenhower Matrix)
- Sub-objectives (subtasks nested under parent tasks)
- Tags/Identifiers
- Collection/List assignment

**Your Personality & Behavior:**
- You are warm, professional, and concise. Think of yourself as a thoughtful productivity coach.
- Give actionable advice. Don't just repeat back what the user says.
- When users ask about productivity techniques, suggest how they can use Task2Do's features (like the Matrix for prioritization, or the Kanban board for workflow tracking).
- Use markdown formatting for clarity (bold, bullet points, numbered lists).
- Keep responses focused and practical — avoid being overly wordy.
- If a user asks you to create, update, or delete a task, acknowledge the request and explain that you can guide them through the steps in the app, since direct task manipulation is coming in a future update.
- You can reference the user's current context (tasks, schedules) when they share it with you.

**Important:** Always maintain the premium, sophisticated tone that matches the Task2Do brand — minimal, elegant, and purposeful.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, tasks } = await request.json();

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

    // Build context-aware system prompt with user's actual task data
    let contextualPrompt = SYSTEM_PROMPT;
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      const taskSummary = tasks
        .filter((t: any) => !t.parentId)
        .slice(0, 50) // Limit to 50 tasks for context window
        .map((t: any) => {
          const parts = [`• "${t.title}"`];
          if (t.status) parts.push(`[${t.status}]`);
          if (t.priority && t.priority > 0) {
            const pLabels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
            parts.push(`Priority: ${pLabels[t.priority] || 'None'}`);
          }
          if (t.startDate) parts.push(`Date: ${new Date(t.startDate).toLocaleDateString()}`);
          if (t.isCompleted) parts.push('✓ Completed');
          if (t.quadrant) parts.push(`Quadrant: ${t.quadrant}`);
          return parts.join(' — ');
        })
        .join('\n');

      contextualPrompt += `\n\n**User's Current Tasks (for context):**\n${taskSummary}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://task2do.app',
        'X-Title': 'Task2Do AI Assistant',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: contextualPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', response.status, errorData);
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
