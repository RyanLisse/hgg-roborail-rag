import { redirect } from 'next/navigation';

export default function RAGPage() {
  // Redirect to main chat since RAG is now integrated
  redirect('/');
}