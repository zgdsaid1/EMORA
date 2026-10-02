import { AuthForm } from '../auth-form';
import { validateReturnTarget } from '../session-recovery';
import { LoginNavigation } from '../shell/auth-navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const returnTo = validateReturnTarget(query.callbackUrl);

  return (
    <>
      <AuthForm mode="login" returnTo={returnTo} />
      <LoginNavigation />
    </>
  );
}
