'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Leaf, MailCheck } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';
import { useForgotPassword } from '@/hooks/use-queries';

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');

    try {
      await forgotPassword.mutateAsync({ email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to request a password reset. Please try again.',
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
              {submitted ? (
                <MailCheck className="text-primary-foreground" size={22} />
              ) : (
                <Leaf className="text-primary-foreground" size={22} />
              )}
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {submitted ? 'Check your email' : 'Forgot your password?'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {submitted
                ? 'If an account exists for that email, we sent a password reset link.'
                : 'Enter your email and we will send you a secure reset link.'}
            </p>
          </div>

          {!submitted && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@fudfarmer.com"
                  autoComplete="email"
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/8 px-3 py-2 text-[13px] font-medium text-destructive">
                  {error}
                </p>
              )}

              <SubmitButton
                type="submit"
                loading={forgotPassword.isPending}
                className="h-10 w-full rounded-lg shadow-md shadow-primary/20 active:scale-[0.98]"
              >
                Send reset link
              </SubmitButton>
            </form>
          )}

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
