export interface InvestmentPlanDef {
  code: string;
  name: string;
  investment: number;
  dailyMining: number;
  periodDays: number;
}

export const INVESTMENT_PLANS: InvestmentPlanDef[] = [
  { code: 'A', name: 'Plan A', investment: 600, dailyMining: 100, periodDays: 365 },
  { code: 'B', name: 'Plan B', investment: 1500, dailyMining: 200, periodDays: 365 },
  { code: 'C', name: 'Plan C', investment: 3000, dailyMining: 500, periodDays: 365 },
  { code: 'D', name: 'Plan D', investment: 5000, dailyMining: 750, periodDays: 365 },
  { code: 'E', name: 'Plan E', investment: 8000, dailyMining: 1200, periodDays: 365 },
  { code: 'F', name: 'Plan F', investment: 12000, dailyMining: 2000, periodDays: 365 },
  { code: 'G', name: 'Plan G', investment: 25000, dailyMining: 5000, periodDays: 365 },
  { code: 'H', name: 'Plan H', investment: 50000, dailyMining: 12000, periodDays: 365 },
  { code: 'I', name: 'Plan I', investment: 75000, dailyMining: 20000, periodDays: 365 },
  { code: 'J', name: 'Plan J', investment: 100000, dailyMining: 30000, periodDays: 365 },
  { code: 'K', name: 'Plan K', investment: 150000, dailyMining: 35000, periodDays: 365 },
  { code: 'L', name: 'Plan L', investment: 500000, dailyMining: 50000, periodDays: 365 },
  { code: 'M', name: 'Plan M', investment: 1000000, dailyMining: 100000, periodDays: 365 },
];

export const DEFAULT_PLATFORM_SETTINGS = {
  termsVersion: 'v1.0-sandbox',
  registrationBonus: 150,
  dailyCheckinAmount: 2,
  minWithdrawal: 150,
  withdrawalFeePercent: 17,
  purchaseLimit: 2,
  referralLevel1Percent: 20,
  referralLevel2Percent: 2,
  referralLevel3Percent: 1,
  depositCbeAccountName: 'CBE (Commercial Bank of Ethiopia)',
  depositCbeAccountNumber: '1000673029578',
  withdrawalMethodOnly: 'CBE (Commercial Bank of Ethiopia)',
  maintenanceMode: false,
};

export const COMPANY_INFO = {
  name: 'The Coca-Cola Company',
  founded: 'January 29, 1892',
  founder: 'Asa Griggs Candler',
  headquarters: 'Atlanta, Georgia, USA',
  industry: 'Beverage and Soft Drinks',
  summary:
    "The Coca-Cola Company is one of the world's largest beverage companies. It was founded in 1892 and is headquartered in Atlanta, Georgia, USA. The company produces, markets, and sells a wide range of beverages enjoyed by millions of people around the world.",
  authorizationDisclosure:
    'Brand imagery and company background are presented strictly for owner-configured showcase purposes and do not state or imply corporate endorsement, investment guarantees, or official affiliation without written authorization.',
};

export const TEAM_COUNT_TASKS = [
  { id: 'count_1', title: 'Reward 1: 1 Team Deposit', targetCount: 1, description: '1 qualifying Level 1–3 team member completes a verified purchase/deposit.' },
  { id: 'count_3', title: 'Reward 2: 3 Team Deposits', targetCount: 3, description: '3 qualifying team members complete verified product purchases.' },
  { id: 'count_5', title: 'Reward 3: 5 Team Deposits', targetCount: 5, description: '5 qualifying team members complete verified product purchases.' },
];

export const TEAM_VALUE_TASKS = [
  { id: 'val_1', level: 1, targetAmount: 25000, rewardAmount: 1500 },
  { id: 'val_2', level: 2, targetAmount: 50000, rewardAmount: 3000 },
  { id: 'val_3', level: 3, targetAmount: 100000, rewardAmount: 6000 },
  { id: 'val_4', level: 4, targetAmount: 150000, rewardAmount: 10000 },
  { id: 'val_5', level: 5, targetAmount: 300000, rewardAmount: 20000 },
];

export const DEFAULT_SUPPORT_CHANNELS = [
  {
    id: 'tg_support',
    label: 'Telegram Support',
    handleOrUrl: '@Coca_cola_Custemer_service1',
    href: 'https://t.me/Coca_cola_Custemer_service1',
    kind: 'telegram_support',
  },
  {
    id: 'tg_channel',
    label: 'Telegram Channel',
    handleOrUrl: 'https://t.me/Cocacolacampany',
    href: 'https://t.me/Cocacolacampany',
    kind: 'telegram_channel',
  },
];

export const SUPPLIED_ASSETS = {
  splashDrinkHero: '/assets/aistudio/file_000000001c008208935d475dfdaba74c_5232b299.png',
  bottles: '/assets/aistudio/bottles_3242d4ef.jpg',
  factory: '/assets/aistudio/factory_93c2daeb.jpg',
  planLogo: '/assets/aistudio/images__1__76226b6b.jpeg',
};
