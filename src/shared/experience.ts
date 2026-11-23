export interface AchievementDetail {
  title: string;
  description: string;
  category?: 'reward' | 'milestone' | 'welcome';
}

const GUIDE_PENDING_PREFIX = 'cc:new-customer-guide:pending:';
const GUIDE_DISMISSED_PREFIX = 'cc:new-customer-guide:dismissed:';

function storageRead(key: string): string | null {
  try {
    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) return localValue;
  } catch {
    // Private browsing modes may block localStorage.
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep a tab-scoped fallback when persistent browser storage is blocked.
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // The guide is an enhancement and must never interrupt registration.
  }
}

function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function queueNewCustomerGuide(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  storageWrite(`${GUIDE_PENDING_PREFIX}${userId}`, '1');
  storageRemove(`${GUIDE_DISMISSED_PREFIX}${userId}`);
}

export function shouldShowNewCustomerGuide(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  const pending = storageRead(`${GUIDE_PENDING_PREFIX}${userId}`) === '1';
  const dismissed = storageRead(`${GUIDE_DISMISSED_PREFIX}${userId}`) === '1';
  return pending && !dismissed;
}

export function dismissNewCustomerGuide(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  storageWrite(`${GUIDE_DISMISSED_PREFIX}${userId}`, '1');
  storageRemove(`${GUIDE_PENDING_PREFIX}${userId}`);
}

export function celebrateAchievement(detail: AchievementDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AchievementDetail>('cc:achievement', { detail }));
}
