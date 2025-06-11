import { VectorStoreMonitoring } from '@/components/vector-store-monitoring';
import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';

export default async function MonitoringPage() {
  const session = await auth();

  // For development, allow access without authentication
  // In production, you might want to restrict this to admin users
  if (!session && process.env.NODE_ENV === 'production') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <VectorStoreMonitoring />
    </div>
  );
}

export const metadata = {
  title: 'Vector Store Monitoring | RRA',
  description: 'Real-time monitoring and analytics for vector store performance',
};