import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  type FeedbackUpdate,
  getFeedbackService,
  hasUserVoted,
  type MessageFeedback,
} from '@/lib/feedback/feedback';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const feedbackService = await getFeedbackService();

    const feedback: MessageFeedback = {
      ...body,
      userId: session.user.id,
    };

    const result = await feedbackService.submitFeedback(feedback);
    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('id');

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Feedback ID required' },
        { status: 400 },
      );
    }

    const updates: FeedbackUpdate = await request.json();
    const feedbackService = await getFeedbackService();

    const result = await feedbackService.updateFeedback(feedbackId, updates);
    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const runId = searchParams.get('runId');
    const userId = session.user.id;

    const feedbackService = await getFeedbackService();

    if (messageId) {
      // Get feedback for specific message
      const result = await hasUserVoted(feedbackService, messageId, userId);
      return NextResponse.json(result);
    } else if (runId) {
      // Get all feedback for run ID
      const result = await feedbackService.getFeedbackByRunId(runId);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'messageId or runId required' },
        { status: 400 },
      );
    }
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to get feedback' },
      { status: 500 },
    );
  }
}
