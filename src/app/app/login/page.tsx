import LoginContent from '@/components/app/LoginContent';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoginContent next={params.next} />
    </div>
  );
}