import { redirect } from 'next/navigation';

export default async function WealthAIRedirectPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolved = await params;
  const suffix = resolved.slug?.length ? `/${resolved.slug.join('/')}` : '/dashboard';
  redirect(`/pocket-tracker${suffix}`);
}
