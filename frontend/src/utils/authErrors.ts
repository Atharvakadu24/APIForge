/**
 * Authentication Error Parser & Formatter
 * Translates Supabase Auth errors, network exceptions, and configuration failures
 * into clear, actionable, user-friendly messages without exposing internal stack traces or secrets.
 */

export function formatAuthError(error: unknown): string {
  if (!error) return '';

  const errorObj = error as Record<string, any>;
  const rawMessage = (typeof errorObj.message === 'string' ? errorObj.message : '').trim();
  const errorName = (typeof errorObj.name === 'string' ? errorObj.name : '').trim();
  const errorCode = (typeof errorObj.code === 'string' ? errorObj.code : '').trim();
  const status = typeof errorObj.status === 'number' ? errorObj.status : 0;

  // 1. Network / DNS / Fetch failures ("Failed to fetch", "fetch failed", "NetworkError")
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('ENOTFOUND') ||
    rawMessage.includes('ECONNREFUSED') ||
    errorName === 'AuthRetryableFetchError' ||
    errorName === 'TypeError'
  ) {
    return 'Unable to reach the authentication service. Please check your internet connection and verify that the Supabase project is online and reachable.';
  }

  // 2. Configuration errors
  if (
    rawMessage.includes('placeholder.supabase.co') ||
    rawMessage.includes('placeholder-anon-key') ||
    rawMessage.includes('VITE_SUPABASE_URL') ||
    rawMessage.includes('API key') ||
    rawMessage.includes('No API key') ||
    rawMessage.includes('Invalid API key')
  ) {
    return 'Supabase project configuration is missing or invalid. Please check your frontend environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).';
  }

  // 3. Invalid credentials (or unconfirmed account under user enumeration protection)
  if (
    rawMessage.includes('Invalid login credentials') ||
    rawMessage.includes('invalid_credentials') ||
    errorCode === 'invalid_credentials'
  ) {
    return 'Invalid email address or password. Please verify your credentials, or if you recently registered, check your inbox to confirm your email address.';
  }

  // 4. Email not confirmed
  if (
    rawMessage.includes('Email not confirmed') ||
    rawMessage.includes('email_not_confirmed') ||
    errorCode === 'email_not_confirmed'
  ) {
    return 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link before signing in.';
  }

  // 5. Existing account / duplicate signup
  if (
    rawMessage.includes('User already registered') ||
    rawMessage.includes('user_already_exists') ||
    rawMessage.includes('already exists') ||
    errorCode === 'user_already_exists'
  ) {
    return 'An account with this email address already exists. Please sign in or use Forgot Password.';
  }

  // 6. Rate limits (email sending or request rate limit)
  if (
    rawMessage.includes('over_email_send_rate_limit') ||
    rawMessage.includes('rate limit') ||
    rawMessage.includes('Rate limit exceeded') ||
    rawMessage.includes('too many requests') ||
    errorCode === 'over_email_send_rate_limit' ||
    status === 429
  ) {
    return 'Security rate limit reached. Please wait a few minutes before trying again.';
  }

  // 7. Password requirements / weak password
  if (
    rawMessage.includes('Password should be at least') ||
    rawMessage.includes('weak_password') ||
    rawMessage.includes('password is too weak')
  ) {
    return 'Password does not meet security requirements. Passwords must be at least 6 characters long.';
  }

  // 8. Expired or invalid recovery/auth token
  if (
    rawMessage.includes('AuthSessionMissingError') ||
    rawMessage.toLowerCase().includes('session missing') ||
    rawMessage.toLowerCase().includes('auth session missing') ||
    rawMessage.includes('Token has expired') ||
    rawMessage.includes('invalid_token') ||
    rawMessage.includes('otp_expired') ||
    rawMessage.includes('recovery link has expired') ||
    errorName === 'AuthSessionMissingError'
  ) {
    return 'The password reset link has expired or has already been used. Please request a new reset link.';
  }

  // 9. Generic fallback with cleaned message
  if (rawMessage.length > 0 && rawMessage.length < 200) {
    return rawMessage;
  }

  return 'An unexpected authentication error occurred. Please try again.';
}
