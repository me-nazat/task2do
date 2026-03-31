'use client';

import { useParams } from 'next/navigation';
import { WealthAIApp } from '@/components/wealth/WealthAIApp';

export default function PocketTrackerPage() {
  const params = useParams<{ slug?: string[] }>();

  return <WealthAIApp slug={params.slug} />;
}
