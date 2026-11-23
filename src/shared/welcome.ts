export type WelcomeKind = 'register' | 'login';

export function triggerWelcomeCelebration(kind: WelcomeKind, name: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cc:welcome', {
    detail: { kind, name: String(name || '').trim() },
  }));
}
