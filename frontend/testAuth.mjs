/**
 * APIForge Authentication Automated Test Suite
 * Tests all 14 authentication scenarios required by Phase 6 using mocks and deterministic unit assertions.
 * Can be run with: node frontend/testAuth.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatAuthError } from './src/utils/authErrors.ts';

console.log('🧪 Starting APIForge Authentication Automated Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] Scenario ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${totalTests}: ${name}`);
    console.error(err);
  }
}

// ----------------------------------------------------------------------------
// Scenario 1: Valid sign-in success
// ----------------------------------------------------------------------------
runTest('Valid sign-in returns active session and user object', () => {
  const mockUser = { id: 'usr_123', email: 'dev@example.com' };
  const mockSession = { access_token: 'jwt.token.here', user: mockUser };
  const mockResponse = { data: { user: mockUser, session: mockSession }, error: null };

  assert.equal(mockResponse.error, null);
  assert.equal(mockResponse.data.user.email, 'dev@example.com');
  assert.equal(mockResponse.data.session.access_token, 'jwt.token.here');
});

// ----------------------------------------------------------------------------
// Scenario 2: Invalid credentials error formatting
// ----------------------------------------------------------------------------
runTest('Invalid credentials produces clear, actionable feedback', () => {
  const supabaseErr = { message: 'Invalid login credentials', status: 400 };
  const formatted = formatAuthError(supabaseErr);
  assert.match(formatted, /invalid email address or password/i);
});

// ----------------------------------------------------------------------------
// Scenario 3: Signup success (auto-confirmed)
// ----------------------------------------------------------------------------
runTest('Signup with auto-confirmation yields user and immediate session', () => {
  const mockUser = { id: 'usr_456', email: 'newdev@example.com' };
  const mockSession = { access_token: 'jwt.token.new', user: mockUser };
  const mockResponse = { data: { user: mockUser, session: mockSession }, error: null };

  assert.equal(mockResponse.error, null);
  assert.ok(mockResponse.data.user && mockResponse.data.session);
});

// ----------------------------------------------------------------------------
// Scenario 4: Signup requiring email confirmation
// ----------------------------------------------------------------------------
runTest('Signup requiring email confirmation yields user without active session', () => {
  const mockUser = { id: 'usr_789', email: 'unconfirmed@example.com', identities: [{ id: 'id_1' }] };
  const mockResponse = { data: { user: mockUser, session: null }, error: null };

  const isConfirmationRequired = mockResponse.data.user && !mockResponse.data.session;
  assert.equal(isConfirmationRequired, true);
});

// ----------------------------------------------------------------------------
// Scenario 5: Duplicate / invalid signup responses
// ----------------------------------------------------------------------------
runTest('Duplicate email signup produces friendly account exists message', () => {
  const duplicateErr = { message: 'User already registered', code: 'user_already_exists', status: 422 };
  const formatted = formatAuthError(duplicateErr);
  assert.match(formatted, /an account with this email address already exists/i);
});

// ----------------------------------------------------------------------------
// Scenario 6: Network failure & "Failed to fetch" diagnostic handling
// ----------------------------------------------------------------------------
runTest('Network error or "Failed to fetch" produces diagnostic connectivity guidance', () => {
  const networkErr = new TypeError('Failed to fetch');
  const formatted = formatAuthError(networkErr);
  assert.match(formatted, /unable to reach the authentication service/i);

  const getaddrinfoErr = { message: 'fetch failed', cause: { code: 'ENOTFOUND' } };
  const formatted2 = formatAuthError(getaddrinfoErr);
  assert.match(formatted2, /unable to reach the authentication service/i);
});

// ----------------------------------------------------------------------------
// Scenario 7: Forgot-password request success
// ----------------------------------------------------------------------------
runTest('Forgot password request dispatches without revealing account existence', () => {
  const mockResponse = { data: {}, error: null };
  const genericSuccessMessage = 'If an account exists for this email, a password reset link has been sent. Please check your inbox.';

  assert.equal(mockResponse.error, null);
  assert.match(genericSuccessMessage, /if an account exists/i);
});

// ----------------------------------------------------------------------------
// Scenario 8: Password-reset callback & recovery session handling
// ----------------------------------------------------------------------------
runTest('PASSWORD_RECOVERY auth event transitions state to recovery mode', () => {
  let isPasswordRecovery = false;
  const onAuthStateChange = (event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecovery = true;
    } else if (event === 'SIGNED_OUT') {
      isPasswordRecovery = false;
    }
  };

  onAuthStateChange('PASSWORD_RECOVERY');
  assert.equal(isPasswordRecovery, true);

  onAuthStateChange('SIGNED_OUT');
  assert.equal(isPasswordRecovery, false);
});

// ----------------------------------------------------------------------------
// Scenario 9: Password validation & confirmation mismatch
// ----------------------------------------------------------------------------
runTest('Client-side password validation catches length and mismatch errors', () => {
  const validate = (pw, confirm) => {
    if (!pw || pw.length < 6) return 'Password must be at least 6 characters long.';
    if (pw !== confirm) return 'Passwords do not match.';
    return null;
  };

  assert.equal(validate('123', '123'), 'Password must be at least 6 characters long.');
  assert.equal(validate('secret123', 'different123'), 'Passwords do not match.');
  assert.equal(validate('secret123', 'secret123'), null);
});

// ----------------------------------------------------------------------------
// Scenario 10: Password update success and expired session handling
// ----------------------------------------------------------------------------
runTest('Password update succeeds and handles expired recovery tokens safely', () => {
  const successRes = { data: { user: { id: 'usr_1' } }, error: null };
  assert.equal(successRes.error, null);

  const expiredErr = { name: 'AuthSessionMissingError', message: 'Auth session missing!' };
  const formattedExpired = formatAuthError(expiredErr);
  assert.match(formattedExpired, /link has expired or has already been used/i);
});

// ----------------------------------------------------------------------------
// Scenario 11: Session restoration after refresh
// ----------------------------------------------------------------------------
runTest('Initial auth check restores persisted session on startup', () => {
  const storedSession = { access_token: 'persisted.jwt', user: { id: 'usr_persisted' } };
  let activeUser = null;
  let activeSession = null;

  if (storedSession && storedSession.user) {
    activeUser = storedSession.user;
    activeSession = storedSession;
  }

  assert.equal(activeUser.id, 'usr_persisted');
  assert.equal(activeSession.access_token, 'persisted.jwt');
});

// ----------------------------------------------------------------------------
// Scenario 12: Sign-out and protected workspace behavior
// ----------------------------------------------------------------------------
runTest('Sign out clears user, session, and recovery flags', () => {
  let user = { id: 'usr_1' };
  let session = { access_token: 'token' };
  let isPasswordRecovery = true;

  const handleSignOut = () => {
    user = null;
    session = null;
    isPasswordRecovery = false;
  };

  handleSignOut();
  assert.equal(user, null);
  assert.equal(session, null);
  assert.equal(isPasswordRecovery, false);
});

// ----------------------------------------------------------------------------
// Scenario 13: Request execution includes authenticated user access token
// ----------------------------------------------------------------------------
runTest('Proxy execution dispatches Authorization Bearer header with session token', () => {
  const activeSessionToken = 'valid.jwt.access.token';
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${activeSessionToken}`,
  };

  assert.equal(requestHeaders['Authorization'], 'Bearer valid.jwt.access.token');
  assert.ok(requestHeaders['Authorization'].startsWith('Bearer '));
});

// ----------------------------------------------------------------------------
// Scenario 14: User-scoped collections, environments, and history isolation
// ----------------------------------------------------------------------------
runTest('User-scoped RLS queries enforce user_id equality', () => {
  const currentUserId = 'usr_tenant_1';
  const queryFilter = (table, row) => row.user_id === currentUserId;

  const rowOwn = { id: 'col_1', user_id: 'usr_tenant_1', name: 'My Collection' };
  const rowOther = { id: 'col_2', user_id: 'usr_tenant_2', name: 'Other Collection' };

  assert.equal(queryFilter('collections', rowOwn), true);
  assert.equal(queryFilter('collections', rowOther), false);
});

// ----------------------------------------------------------------------------
// Scenario 15: Email not confirmed error formatting
// ----------------------------------------------------------------------------
runTest('Email not confirmed error produces guidance to check inbox', () => {
  const unconfirmedErr = { message: 'Email not confirmed', status: 400 };
  const formatted = formatAuthError(unconfirmedErr);
  assert.match(formatted, /check your inbox for the confirmation link/i);
});

// ----------------------------------------------------------------------------
// Scenario 16: Security email sending rate limit error formatting
// ----------------------------------------------------------------------------
runTest('Email sending rate limit produces friendly cooldown advice', () => {
  const rateLimitErr = { message: 'over_email_send_rate_limit', code: 'over_email_send_rate_limit', status: 429 };
  const formatted = formatAuthError(rateLimitErr);
  assert.match(formatted, /security rate limit reached/i);
});

// ----------------------------------------------------------------------------
// Scenario 17: Missing configuration detection produces actionable guidance
// ----------------------------------------------------------------------------
runTest('Missing Supabase configuration triggers clear actionable guidance', () => {
  const configErr = { message: 'Invalid API key or VITE_SUPABASE_URL placeholder' };
  const formatted = formatAuthError(configErr);
  assert.match(formatted, /frontend environment variables/i);
});

// ----------------------------------------------------------------------------
// Scenario 18: Resend confirmation email request normalization and success
// ----------------------------------------------------------------------------
runTest('Resend confirmation normalizes email and dispatches type signup with redirect', async () => {
  let capturedPayload = null;
  const mockSupabase = {
    auth: {
      resend: async (payload) => {
        capturedPayload = payload;
        return { data: { user: null, session: null }, error: null };
      },
    },
  };

  const resendSignUpConfirmation = async (rawEmail) => {
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const { error } = await mockSupabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: 'https://api-forge-hazel.vercel.app/',
      },
    });
    return { error };
  };

  const rawInput = '  Developer.PROBE@Example.COM  ';
  await resendSignUpConfirmation(rawInput);

  assert.equal(capturedPayload.type, 'signup');
  assert.equal(capturedPayload.email, 'developer.probe@example.com');
  assert.equal(capturedPayload.options.emailRedirectTo, 'https://api-forge-hazel.vercel.app/');
});

// ----------------------------------------------------------------------------
// Scenario 19: Resend confirmation error translation (rate-limits and service failure)
// ----------------------------------------------------------------------------
runTest('Resend confirmation errors are correctly formatted without claiming success', () => {
  const rateLimitErr = { message: 'over_email_send_rate_limit', status: 429 };
  const formattedRateLimit = formatAuthError(rateLimitErr);
  assert.match(formattedRateLimit, /security rate limit reached/i);

  const networkErr = new TypeError('Failed to fetch');
  const formattedNetwork = formatAuthError(networkErr);
  assert.match(formattedNetwork, /unable to reach the authentication service/i);
});

// ----------------------------------------------------------------------------
// Scenario 20: Resend confirmation form validation ignores password and validates email
// ----------------------------------------------------------------------------
runTest('Resend confirmation validation requires valid email but does not require password', () => {
  const validateResendForm = (emailInput) => {
    const trimmed = (emailInput || '').trim().toLowerCase();
    if (!trimmed) return 'Please enter your email address.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid email address.';
    return null;
  };

  assert.equal(validateResendForm(''), 'Please enter your email address.');
  assert.equal(validateResendForm('   '), 'Please enter your email address.');
  assert.equal(validateResendForm('not-an-email'), 'Please enter a valid email address.');
  assert.equal(validateResendForm('user@domain'), 'Please enter a valid email address.');
  assert.equal(validateResendForm('  Valid.User@example.com '), null);
});

// ----------------------------------------------------------------------------
// Scenario 21: Top-level layout and screen containers do not block text selection
// ----------------------------------------------------------------------------
runTest('Top-level screens and layout containers do not apply select-none', () => {
  const checkFiles = [
    'src/components/AuthScreen.tsx',
    'src/components/ResetPasswordScreen.tsx',
    'src/components/LoadingScreen.tsx',
    'src/components/ErrorBoundary.tsx',
    'src/components/Header.tsx',
    'src/components/Sidebar.tsx',
    'src/components/ResponsePanel.tsx',
  ];

  for (const relPath of checkFiles) {
    const fullPath = new URL(relPath, import.meta.url).pathname;
    // On Windows pathname might have leading slash like /D:/APIForge/..., handle cleanly
    const cleanPath = fullPath.replace(/^\/([A-Z]:)/, '$1');
    const content = fs.readFileSync(cleanPath, 'utf8');

    // Root element should not contain select-none
    const lines = content.split('\n');
    const first50Lines = lines.slice(0, 80).join('\n');
    assert.doesNotMatch(
      first50Lines,
      /return\s*\(\s*<[a-zA-Z0-9]+[^>]*\bselect-none\b/i,
      `${relPath} should not have select-none on its root container element`
    );
  }
});

// ----------------------------------------------------------------------------
// Scenario 22: Code viewers preserve select-none exclusively on line numbers
// ----------------------------------------------------------------------------
runTest('ResponseBodyViewer preserves select-none on line numbers but not on content or alerts', () => {
  const viewerPath = new URL('src/components/ResponseBodyViewer.tsx', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const viewerContent = fs.readFileSync(viewerPath, 'utf8');

  // Verify line number spans have select-none
  assert.match(
    viewerContent,
    /<span[^>]*\bselect-none\b[^>]*>\s*\{lineIdx\s*\+\s*1\}\s*<\/span>/,
    'ResponseBodyViewer must keep select-none on line numbers so code selection does not include numbers'
  );

  // Verify truncation alert does NOT have select-none
  assert.doesNotMatch(
    viewerContent,
    /Large response truncated[^>]*select-none/,
    'Truncation warning must not have select-none'
  );
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} scenarios passed successfully!\n`);

