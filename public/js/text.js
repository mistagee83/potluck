// Teacher UI text (English). Sentence case, no exclamation marks, no emoji (Hub voice).
export const TT = {
  appName: 'Potluck',
  tagline: 'Group projects where everyone brings something.',
  signin: {
    title: 'Sign in',
    google: 'Continue with Google',
    or: 'or with e-mail',
    email: 'E-mail',
    password: 'Password',
    submit: 'Sign in',
    forgot: 'Forgot your password?',
    resetHint: 'Type your e-mail above, then click “Forgot your password?” again.',
    resetSent: 'If there is an account for {email}, we have sent a link to reset the password.',
    newHere: 'New here?',
    create: 'Create your account',
    home: 'About Potluck',
  },
  testTeacher: 'Emulator: sign in as the test teacher',
  signOut: 'Sign out',
  loading: 'Loading',
  templatesTitle: 'Templates',
  lessons: '{n} lessons',
  weeks: '{n} weeks',
  ages: 'ages {min}-{max}',
  phases: '{n} phases',
  groupSize: 'groups of {min}-{max}',
};

export const t = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
