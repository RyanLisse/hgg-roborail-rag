import type { Metadata } from 'next';
import { RAGChat } from '@/components/rag-chat';

export const metadata: Metadata = {
  title: 'RAG Chat - AI Assistant',
  description: 'Chat with AI using your uploaded documents for context',
};

export default function RAGPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <RAGChat />
      </div>
    </div>
  );
}