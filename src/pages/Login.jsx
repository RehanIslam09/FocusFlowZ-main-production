import { SignIn } from '@clerk/clerk-react';

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
