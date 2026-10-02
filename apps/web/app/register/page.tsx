import { AuthForm } from '../auth-form';
import { RegisterNavigation } from '../shell/auth-navigation';

export default function RegisterPage() {
  return (
    <>
      <AuthForm mode="register" />
      <RegisterNavigation />
    </>
  );
}
