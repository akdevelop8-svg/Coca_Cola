export type UserRole =
  | 'customer'
  | 'owner_admin'
  | 'finance_admin'
  | 'support_admin'
  | 'content_admin'
  | 'viewer';

export interface UserProfile {
  id: string;
  fullName: string;
  nickname: string | null;
  displayName: string;
  phone: string;
  username?: string | null;
  email: string | null;
  role: UserRole;
  status: 'active' | 'suspended';
  referralCode: string;
  invitedByCode: string | null;
  avatarUrl: string | null;
  termsAcceptedVersion: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
}

export interface WalletSummary {
  availableBalance: number;
  reservedBalance: number;
  promotionalCredit: number;
  totalEarnings: number;
  totalRewards: number;
  teamCommission: number;
  activePlansCount: number;
  maxActivePlans: number;
  teamMembersCount: number;
  qualifyingTeamMembersCount: number;
  checkedInToday: boolean;
  todayEthiopiaDate: string;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  type:
    | 'registration_bonus'
    | 'daily_checkin'
    | 'gift_code'
    | 'plan_purchase'
    | 'daily_mining_claim'
    | 'referral_reward'
    | 'task_reward'
    | 'deposit_credit'
    | 'withdrawal_reserve'
    | 'withdrawal_settle'
    | 'withdrawal_release';
  amountSigned: number;
  balanceAfter: number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface GiftCodeRecord {
  id: string;
  code: string;
  rewardAmount: number;
  isActive: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  createdAt: string;
  deactivatedAt: string | null;
}

export interface GiftCodeRedemptionRecord {
  id: string;
  giftCodeId: string;
  code: string;
  rewardAmount: number;
  customerPhone?: string;
  redeemedAt: string;
}

export interface PaymentMethodRecord {
  id: string;
  kind: 'deposit' | 'payout';
  name: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethodId: string;
  methodName: string;
  accountNumberSnapshot: string;
  amount: number;
  txReference: string;
  hasReceipt: boolean;
  receiptMime: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PayoutAccountRecord {
  id: string;
  userId: string;
  methodName: string;
  accountNumber: string;
  maskedAccountNumber: string;
  accountOwnerName: string;
  status: 'pending' | 'approved' | 'rejected';
  isLocked: boolean;
  reviewNote: string | null;
  updatedAt: string;
}

export interface PayoutChangeRequestRecord {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  reason: string;
  newMethodName: string;
  newAccountNumber: string;
  newAccountOwnerName: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  methodName: string;
  accountNumberSnapshot: string;
  maskedAccountNumber: string;
  accountOwnerSnapshot: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: 'pending' | 'approved' | 'processed' | 'completed' | 'rejected';
  providerReference: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  processedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface SupportChannel {
  id: string;
  label: string;
  handleOrUrl: string;
  href: string;
  kind: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  isReadByAdmin?: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Array<{
    id: string;
    senderRole: string;
    senderName: string;
    message: string;
    createdAt: string;
  }>;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  actionUrl: string | null;
  imageUrl?: string | null;
  broadcastId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  targetType: 'all' | 'single';
  targetUserId: string | null;
  targetPhone: string | null;
  sentByName: string;
  recipientCount: number;
  createdAt: string;
}

export interface CustomerDetailProfile {
  customer: {
    id: string;
    fullName: string;
    nickname?: string | null;
    phone: string;
    role: UserRole;
    status: 'active' | 'suspended';
    referralCode: string;
    invitedBy: { id: string; phone: string; referralCode: string } | null;
    termsAcceptedVersion: string | null;
    termsAcceptedAt: string | null;
    createdAt: string;
    lastActiveAt: string;
  };
  team: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    members: Array<{
      id: string;
      level: 1 | 2 | 3;
      phone: string;
      referralCode: string;
      status: string;
      qualified: boolean;
      registeredAt: string;
    }>;
  };
  deposits: Array<{
    id: string;
    methodName: string;
    accountNumberSnapshot: string;
    amount: number;
    txReference: string;
    status: string;
    rejectionReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    methodName: string;
    accountNumberSnapshot: string;
    accountOwnerSnapshot: string;
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    status: string;
    providerReference: string | null;
    rejectionReason: string | null;
    reviewedAt: string | null;
    processedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  }>;
  planPurchases: Array<{
    id: string;
    planCode: string;
    amount: number;
    dailyMiningRate: number;
    periodDays: number;
    status: string;
    startDate: string;
    endDate: string;
    createdAt: string;
  }>;
  dailyCheckins: Array<{
    id: string;
    ethiopiaDate: string;
    status: string;
    createdAt: string;
  }>;
  dailyClaims: Array<{
    id: string;
    ethiopiaDate: string;
    amount: number;
    planCode: string;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    category: string;
    subject: string;
    status: string;
    isReadByAdmin: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface CarouselAsset {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PlatformConfig {
  complianceApproved: boolean;
  financialOperationsEnabled: boolean;
  adminSetupRequired: boolean;
  giftCodeEnabled: boolean;
  publicSiteUrl: string | null;
  customDomainConfigured: boolean;
  settings: {
    termsVersion: string;
    privacyPolicyUrl: string;
    registrationBonus: number;
    dailyCheckinAmount: number;
    minWithdrawal: number;
    withdrawalFeePercent: number;
    purchaseLimit: number;
    referralLevel1Percent: number;
    referralLevel2Percent: number;
    referralLevel3Percent: number;
    depositCbeAccountName: string;
    depositCbeAccountNumber: string;
    withdrawalMethodOnly: string;
    maintenanceMode: boolean;
  };
  activeDepositMethods?: PaymentMethodRecord[];
  activePayoutMethods?: PaymentMethodRecord[];
  supportChannels: SupportChannel[];
  carouselAssets: CarouselAsset[];
  companyInfo: {
    name: string;
    founded: string;
    founder: string;
    headquarters: string;
    industry: string;
    summary: string;
    authorizationDisclosure: string;
  };
}
