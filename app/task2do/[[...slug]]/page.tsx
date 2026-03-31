'use client';

import { useParams } from 'next/navigation';
import { Task2DoApp } from '@/components/task2do/Task2DoApp';

export default function Task2DoPage() {
  const params = useParams<{ slug?: string[] }>();

  return <Task2DoApp slug={params.slug} />;
}
