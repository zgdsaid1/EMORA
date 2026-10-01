import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main>
      <h1>Password reset unavailable</h1>
      <p>
        Password reset is currently unavailable because reset email delivery is
        not configured.
      </p>
      <p>
        <Link href="/login">Return to sign in</Link>
      </p>
    </main>
  );
}
