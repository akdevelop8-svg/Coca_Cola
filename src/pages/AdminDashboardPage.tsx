import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  Gift,
  Image as ImageIcon,
  Landmark,
  Megaphone,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
  XCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '../api/client';
import { AppShell } from '../components/AppShell';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { CustomerDetailModal } from '../components/admin/CustomerDetailModal';
import { BusinessRulesManager } from '../components/admin/BusinessRulesManager';
import { useAuth } from '../context/AuthContext';
import { formatBrExact, formatEtb } from '../shared/finance';
import type {
  BroadcastItem,
  DepositRequest,
  GiftCodeRecord,
  GiftCodeRedemptionRecord,
  PaymentMethodRecord,
  SupportChannel,
  SupportTicket,
  WithdrawalRequest,
} from '../types';

type AdminTab =
  | 'overview'
  | 'customers'
  | 'deposits'
  | 'withdrawals'
  | 'tickets'
  | 'broadcasts'
  | 'payment_methods'
  | 'gift_codes'
  | 'plans'
  | 'tasks'
  | 'audit';

const parseClockMinutes = (value: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatClock12 = (totalMinutes: number) => {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const withdrawalWindowLabel = (start: string, end: string) => {
  const startMinutes = parseClockMinutes(start);
  const endMinutes = parseClockMinutes(end);
  if (startMinutes === null || endMinutes === null) return 'Enter a valid start and end time.';
  return `${formatClock12(startMinutes)}–${formatClock12(endMinutes)} Ethiopian clock (${formatClock12(startMinutes + 360)}–${formatClock12(endMinutes + 360)} EAT)`;
};

export function AdminDashboardPage() {
  const { user, config, refreshConfig } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<AdminTab>(() =>
    new URLSearchParams(location.search).get('tab') === 'withdrawals' ? 'withdrawals' : 'overview'
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Overview state
  const [overview, setOverview] = useState<any>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Customers state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; phone: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [customerStatusBusy, setCustomerStatusBusy] = useState<string | null>(null);

  // Deposits state
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; mime?: string | null } | null>(null);

  // Withdrawals & Payout Accounts state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(
    () => new URLSearchParams(location.search).get('withdrawalId')
  );
  const [withdrawalFilter, setWithdrawalFilter] = useState<
    'all' | 'pending' | 'approved' | 'processed' | 'completed' | 'rejected'
  >('all');
  const [completionModal, setCompletionModal] = useState<{
    id: string;
    targetStatus: 'processed' | 'completed';
    currentRef: string;
  } | null>(null);
  const [completionRef, setCompletionRef] = useState('');

  // Feedback & Complaints state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'unread' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});

  // Broadcast Messages state
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [bTargetType, setBTargetType] = useState<'all' | 'single'>('all');
  const [bTargetUserId, setBTargetUserId] = useState('');
  const [bImageFile, setBImageFile] = useState<File | null>(null);
  const [bImagePreviewUrl, setBImagePreviewUrl] = useState<string | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Payment Settings & Channels & Policy state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [pmKind, setPmKind] = useState<'deposit' | 'payout'>('deposit');
  const [pmName, setPmName] = useState('');
  const [pmAcctName, setPmAcctName] = useState('');
  const [pmAcctNum, setPmAcctNum] = useState('');
  const [pmInstructions, setPmInstructions] = useState('');
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    accountName: '',
    accountNumber: '',
    instructions: '',
  });
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [chLabel, setChLabel] = useState('');
  const [chHandle, setChHandle] = useState('');
  const [chHref, setChHref] = useState('');

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Gift Code Management state
  const [giftCodeEnabled, setGiftCodeEnabled] = useState(false);
  const [giftCodes, setGiftCodes] = useState<GiftCodeRecord[]>([]);
  const [giftRedemptions, setGiftRedemptions] = useState<GiftCodeRedemptionRecord[]>([]);
  const [gcCode, setGcCode] = useState('');
  const [gcRewardAmount, setGcRewardAmount] = useState('500');
  const [gcMaxRedemptions, setGcMaxRedemptions] = useState('');
  const [gcExpiresAt, setGcExpiresAt] = useState('');
  const [gcSubmitting, setGcSubmitting] = useState(false);

  // Shared Rejection Modal
  const [rejectModal, setRejectModal] = useState<{
    kind: 'deposit' | 'withdrawal';
    id: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'withdrawals') {
      setTab('withdrawals');
      setWithdrawalFilter('all');
      setSelectedWithdrawalId(params.get('withdrawalId'));
    }
  }, [location.search]);

  useEffect(() => {
    if (!bImageFile) {
      setBImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(bImageFile);
    setBImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [bImageFile]);

  const loadTab = async (targetTab: AdminTab) => {
    setErrorMsg('');
    try {
      if (targetTab === 'overview') {
        const qs = new URLSearchParams();
        if (fromDate) qs.set('from', fromDate);
        if (toDate) qs.set('to', toDate);
        const res = await apiFetch(`/api/admin/overview?${qs.toString()}`);
        setOverview(res);
      } else if (targetTab === 'customers') {
        const res = await apiFetch<{ users: any[] }>(
          `/api/admin/users?q=${encodeURIComponent(userSearch)}`
        );
        setUsersList(res.users);
      } else if (targetTab === 'deposits') {
        const res = await apiFetch<{ deposits: DepositRequest[] }>('/api/admin/deposits');
        setDeposits(res.deposits);
      } else if (targetTab === 'withdrawals') {
        const res = await apiFetch<{ withdrawals: WithdrawalRequest[] }>('/api/admin/withdrawals');
        setWithdrawals(res.withdrawals || []);
      } else if (targetTab === 'tickets') {
        const res = await apiFetch<{ tickets: SupportTicket[] }>('/api/admin/tickets');
        setTickets(res.tickets);
      } else if (targetTab === 'broadcasts') {
        const [bRes, uRes] = await Promise.all([
          apiFetch<{ broadcasts: BroadcastItem[] }>('/api/admin/broadcasts'),
          apiFetch<{ users: any[] }>('/api/admin/users'),
        ]);
        setBroadcasts(bRes.broadcasts);
        setUsersList(uRes.users);
      } else if (targetTab === 'payment_methods') {
        const [pmRes, cRes] = await Promise.all([
          apiFetch<{ methods: PaymentMethodRecord[] }>('/api/admin/payment-methods'),
          apiFetch<{ settings: any; channels: SupportChannel[] }>('/api/admin/content'),
        ]);
        setPaymentMethods(pmRes.methods);
        setSettingsForm(cRes.settings);
        setChannels(cRes.channels);
      } else if (targetTab === 'gift_codes') {
        const res = await apiFetch<{
          isEnabled: boolean;
          codes: GiftCodeRecord[];
          redemptions: GiftCodeRedemptionRecord[];
        }>('/api/admin/gift-codes');
        setGiftCodeEnabled(Boolean(res.isEnabled));
        setGiftCodes(res.codes);
        setGiftRedemptions(res.redemptions);
      } else if (targetTab === 'audit') {
        const res = await apiFetch<{ logs: any[] }>('/api/admin/audit-logs');
        setAuditLogs(res.logs);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load admin data.');
    }
  };

  useEffect(() => {
    void loadTab(tab);
  }, [tab]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void apiFetch('/api/admin/overview')
        .then((result) => setOverview(result))
        .catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  // --- Deposit Handlers ---
  const handleApproveDeposit = async (id: string) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/deposits/${id}/approve`, { method: 'POST' });
      setStatusMsg('Deposit approved and user wallet credited atomically.');
      await loadTab('deposits');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not approve deposit.');
    }
  };

  // --- Withdrawal Handlers ---
  const handleApproveWithdrawal = async (id: string) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setStatusMsg('Withdrawal approved. Funds remain reserved until the manual bank transfer is recorded as completed.');
      await loadTab('withdrawals');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not approve withdrawal.');
    }
  };

  const handleConfirmWithdrawalComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionModal) return;
    if (completionRef.trim().length < 4) {
      setErrorMsg('Enter the bank transaction short code (at least 4 characters) after making the manual bank transfer.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/withdrawals/${completionModal.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          status: completionModal.targetStatus,
          bankTransferReference: completionRef.trim(),
        }),
      });
      setStatusMsg(`Withdrawal marked as ${completionModal.targetStatus} and customer notified.`);
      setCompletionModal(null);
      setCompletionRef('');
      await loadTab('withdrawals');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update withdrawal completion status.');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    setErrorMsg('');
    setStatusMsg('');
    try {
      if (rejectModal.kind === 'deposit') {
        await apiFetch(`/api/admin/deposits/${rejectModal.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason }),
        });
        setStatusMsg('Deposit rejected and customer notified.');
        await loadTab('deposits');
      } else if (rejectModal.kind === 'withdrawal') {
        await apiFetch(`/api/admin/withdrawals/${rejectModal.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason }),
        });
        setStatusMsg('Withdrawal rejected and reserved balance released.');
        await loadTab('withdrawals');
      }
      setRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Rejection failed.');
    }
  };

  // --- Feedback & Ticket Handlers ---
  const handleUpdateTicketStatus = async (
    ticketId: string,
    payload: { status?: 'open' | 'in_progress' | 'resolved' | 'closed'; isRead?: boolean }
  ) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatusMsg('Feedback status updated.');
      await loadTab('tickets');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update ticket status.');
    }
  };

  const handleTicketReply = async (
    ticketId: string,
    status: 'in_progress' | 'resolved' | 'closed'
  ) => {
    const msg = ticketReplies[ticketId]?.trim();
    if (!msg) {
      setErrorMsg('Enter a reply message before sending.');
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: msg, status }),
      });
      setTicketReplies((p) => ({ ...p, [ticketId]: '' }));
      setStatusMsg('Reply sent and customer notified.');
      await loadTab('tickets');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to reply to ticket.');
    }
  };

  // --- Broadcast Handlers ---
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    if (bTargetType === 'single' && !bTargetUserId) {
      setErrorMsg('Select a customer recipient before sending a targeted announcement.');
      return;
    }
    setSendingBroadcast(true);
    try {
      const formData = new FormData();
      formData.append('title', bTitle.trim());
      formData.append('message', bMessage.trim());
      formData.append('targetType', bTargetType);
      if (bTargetType === 'single') {
        formData.append('targetUserId', bTargetUserId);
      }
      if (bImageFile) {
        formData.append('image', bImageFile);
      }
      const res = await apiFetch<{ recipientCount: number }>('/api/admin/broadcasts', {
        method: 'POST',
        body: formData,
      });
      setStatusMsg(`Broadcast sent successfully to ${res.recipientCount} customer(s).`);
      setBTitle('');
      setBMessage('');
      setBTargetUserId('');
      setBImageFile(null);
      await loadTab('broadcasts');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send broadcast.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // --- Payment Settings Handlers ---
  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch('/api/admin/payment-methods', {
        method: 'POST',
        body: JSON.stringify({
          kind: pmKind,
          name: pmName,
          accountName: pmAcctName,
          accountNumber: pmAcctNum,
          instructions: pmInstructions,
        }),
      });
      setPmName('');
      setPmAcctName('');
      setPmAcctNum('');
      setPmInstructions('');
      setStatusMsg('Payment method created and synced to customer platform.');
      await refreshConfig();
      await loadTab('payment_methods');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add payment method.');
    }
  };

  const handleToggleMethod = async (m: PaymentMethodRecord) => {
    setErrorMsg('');
    try {
      await apiFetch(`/api/admin/payment-methods/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      await refreshConfig();
      await loadTab('payment_methods');
      setStatusMsg(`Payment method "${m.name}" ${!m.isActive ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update payment method.');
    }
  };

  const handleStartEditMethod = (m: PaymentMethodRecord) => {
    setEditingMethodId(m.id);
    setEditForm({
      name: m.name,
      accountName: m.accountName || '',
      accountNumber: m.accountNumber || '',
      instructions: m.instructions || '',
    });
  };

  const handleSaveEditMethod = async (id: string) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/payment-methods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setEditingMethodId(null);
      await refreshConfig();
      await loadTab('payment_methods');
      setStatusMsg('Payment method updated and applied immediately.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update payment method.');
    }
  };

  const handleDeleteMethod = async (m: PaymentMethodRecord) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/payment-methods/${m.id}`, { method: 'DELETE' });
      await refreshConfig();
      await loadTab('payment_methods');
      setStatusMsg(`Payment method "${m.name}" deleted.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete payment method.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    const withdrawalStart = String(settingsForm?.withdrawalStartTime ?? '04:00');
    const withdrawalEnd = String(settingsForm?.withdrawalEndTime ?? '11:00');
    if (
      parseClockMinutes(withdrawalStart) === null ||
      parseClockMinutes(withdrawalEnd) === null ||
      withdrawalStart === withdrawalEnd
    ) {
      setErrorMsg('Enter valid Ethiopian-clock withdrawal times. Start and end times must be different.');
      return;
    }
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: settingsForm }),
      });
      await refreshConfig();
      setStatusMsg('Withdrawal & platform policy settings saved and applied.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save platform settings.');
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({ label: chLabel, handleOrUrl: chHandle, href: chHref }),
      });
      setChLabel('');
      setChHandle('');
      setChHref('');
      await refreshConfig();
      await loadTab('payment_methods');
      setStatusMsg('Support channel added.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add support channel.');
    }
  };

  const handleRestoreCustomer = async (customer: any) => {
    if (customerStatusBusy) return;
    setErrorMsg('');
    setStatusMsg('');
    setCustomerStatusBusy(customer.id);
    try {
      await apiFetch(`/api/admin/users/${customer.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'active' }),
      });
      setStatusMsg(`Customer ${customer.phone} restored.`);
      await loadTab('customers');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to restore customer account.');
    } finally {
      setCustomerStatusBusy(null);
    }
  };

  const handleConfirmSuspendCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = suspendTarget;
    const reason = suspendReason.trim();
    if (!target || customerStatusBusy || reason.length < 8) return;
    setErrorMsg('');
    setStatusMsg('');
    setCustomerStatusBusy(target.id);
    try {
      await apiFetch(`/api/admin/users/${target.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'suspended', reason }),
      });
      setStatusMsg(`Customer ${target.phone} suspended.`);
      setSuspendTarget(null);
      setSuspendReason('');
      await loadTab('customers');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to suspend customer account.');
    } finally {
      setCustomerStatusBusy(null);
    }
  };

  // --- Gift Code Management Handlers ---
  const handleToggleGiftFeature = async (nextEnabled: boolean) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch('/api/admin/gift-codes/settings', {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: nextEnabled }),
      });
      await refreshConfig();
      await loadTab('gift_codes');
      setStatusMsg(
        nextEnabled
          ? 'Gift Code feature is now ENABLED for customers.'
          : 'Gift Code feature is now DISABLED and hidden from customers.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update Gift Code feature setting.');
    }
  };

  const handleGenerateGiftCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setGcCode(`COLA-${suffix}`);
  };

  const handleCreateGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setGcSubmitting(true);
    try {
      const payload: Record<string, any> = {
        code: gcCode.trim().toUpperCase(),
        rewardAmount: Number(gcRewardAmount),
      };
      if (gcMaxRedemptions.trim()) {
        payload.maxRedemptions = Number(gcMaxRedemptions.trim());
      }
      if (gcExpiresAt.trim()) {
        payload.expiresAt = new Date(gcExpiresAt).toISOString();
      }
      const res = await apiFetch<{ success: boolean; giftCode: GiftCodeRecord }>('/api/admin/gift-codes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatusMsg(`Gift code "${res.giftCode.code}" created and published with a reward of ${formatEtb(res.giftCode.rewardAmount)}.`);
      setGcCode('');
      setGcRewardAmount('500');
      setGcMaxRedemptions('');
      setGcExpiresAt('');
      await loadTab('gift_codes');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create gift code.');
    } finally {
      setGcSubmitting(false);
    }
  };

  const handleDeactivateGiftCode = async (g: GiftCodeRecord) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/admin/gift-codes/${g.id}/deactivate`, { method: 'POST' });
      setStatusMsg(`Gift code "${g.code}" deactivated.`);
      await loadTab('gift_codes');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to deactivate gift code.');
    }
  };

  const exportOverviewCsv = () => {
    if (!overview) return;
    const rows = Object.entries(overview).map(([k, v]) => `${k},${v}`);
    const blob = new Blob([`Metric,Value\n${rows.join('\n')}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDeposits = useMemo(
    () => (depositFilter === 'all' ? deposits : deposits.filter((d) => d.status === depositFilter)),
    [deposits, depositFilter]
  );

  const filteredWithdrawals = useMemo(
    () =>
      withdrawalFilter === 'all'
        ? withdrawals
        : withdrawals.filter((w) => w.status === withdrawalFilter),
    [withdrawals, withdrawalFilter]
  );
  const selectedWithdrawal = useMemo(
    () => withdrawals.find((w) => w.id === selectedWithdrawalId) || null,
    [withdrawals, selectedWithdrawalId]
  );

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return tickets;
    if (ticketFilter === 'unread') return tickets.filter((t) => !t.isReadByAdmin);
    return tickets.filter((t) => t.status === ticketFilter);
  }, [tickets, ticketFilter]);

  const depositMethodsList = paymentMethods.filter((m) => m.kind === 'deposit');
  const payoutMethodsList = paymentMethods.filter((m) => m.kind === 'payout');
  const selectedCustomerObj = usersList.find((u) => u.id === bTargetUserId);

  // Admin navigation sections (including Gift Code Management)
  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Dashboard Overview', icon: ShieldCheck },
    { id: 'customers', label: 'Customer Management', icon: Users },
    { id: 'deposits', label: 'Deposit Requests', icon: Wallet },
    { id: 'withdrawals', label: 'Withdrawal Requests', icon: Landmark },
    { id: 'tickets', label: 'Customer Inbox', icon: MessageSquare },
    { id: 'broadcasts', label: 'Broadcast Messages', icon: Megaphone },
    { id: 'payment_methods', label: 'Payment Settings', icon: Settings },
    { id: 'gift_codes', label: 'Gift Code Management', icon: Gift },
    { id: 'plans', label: 'Investment Plans', icon: SlidersHorizontal },
    { id: 'tasks', label: 'Task Management', icon: ClipboardList },
    { id: 'audit', label: 'Admin Activity/Audit Log', icon: ClipboardList },
  ];

  return (
    <AppShell title="Admin Dashboard">
      <div className="space-y-5">
        {/* Admin Header */}
        <div className="rounded-2xl bg-gradient-to-r from-[#8C060A] to-[#D71920] text-white p-5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div>
            <h2 className="text-xl font-bold">Protected Admin Control Center</h2>
            <p className="text-xs text-white/85 mt-0.5">
              Signed in as {user?.phone || user?.fullName} · Role:{' '}
              <strong className="uppercase">{user?.role}</strong> · API
            </p>
          </div>
          {overview && tab === 'overview' && (
            <button
              type="button"
              onClick={exportOverviewCsv}
              className="px-4 py-2 rounded-full bg-white text-[#D71920] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        {/* Admin sections: vertical controls on the left, workspace on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <nav aria-label="Admin Dashboard Sections" className="lg:col-span-3 flex flex-row flex-wrap lg:flex-col lg:items-stretch gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 lg:sticky lg:top-20">
          {tabs.map((t) => {
            const Icon = t.icon;
            const count = t.id === 'deposits'
              ? Number(overview?.pendingDepositsCount || 0)
              : t.id === 'withdrawals'
                ? Number(overview?.pendingWithdrawalsCount || 0)
                : t.id === 'tickets'
                  ? Number(overview?.unreadTickets || 0)
                  : 0;
            const amount = t.id === 'deposits'
              ? Number(overview?.pendingDepositsAmount || 0)
              : t.id === 'withdrawals'
                ? Number(overview?.pendingWithdrawalsAmount || 0)
                : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'bg-[#D71920] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums whitespace-nowrap ${
                    tab === t.id ? 'bg-white text-[#B80D13]' :
                    t.id === 'tickets' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                  }`}>
                    {count}
                    {t.id !== 'tickets' && ` · ${formatBrExact(amount)}`}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 lg:col-span-9 space-y-5">

        {statusMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {tab === 'plans' && <BusinessRulesManager mode="plans" />}
        {tab === 'tasks' && <BusinessRulesManager mode="tasks" />}

        {/* 1. DASHBOARD OVERVIEW */}
        {tab === 'overview' && overview && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="ov-from" className="block text-xs text-slate-500 mb-1">From Date</label>
                <input
                  id="ov-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <p className="mt-1 text-[11px] font-semibold text-amber-700">Choose the first date in the reporting period.</p>
              </div>
              <div>
                <label htmlFor="ov-to" className="block text-xs text-slate-500 mb-1">To Date</label>
                <input
                  id="ov-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <p className="mt-1 text-[11px] font-semibold text-amber-700">Choose the last date in the reporting period.</p>
              </div>
              <button
                type="button"
                onClick={() => loadTab('overview')}
                className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold cursor-pointer"
              >
                Apply Filter
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Registered Customers', val: overview.totalUsers },
                { label: 'Active Sessions', val: overview.activeSessionsCount },
                { label: 'Pending Deposits', val: `${overview.pendingDepositsCount} (${formatBrExact(overview.pendingDepositsAmount)})` },
                { label: 'Approved Deposits', val: formatBrExact(overview.approvedDepositsTotal) },
                { label: 'Pending Withdrawals', val: `${overview.pendingWithdrawalsCount} (${formatBrExact(overview.pendingWithdrawalsAmount)})` },
                { label: 'Approved Withdrawals', val: formatBrExact(overview.approvedWithdrawalsTotal) },
                { label: 'Completed Withdrawals', val: overview.completedWithdrawalsCount ?? 0 },
                { label: 'Unread / Open Feedback', val: `${overview.unreadTickets ?? 0} unread / ${overview.openTickets}` },
                { label: 'Verified Sales', val: `${overview.verifiedSalesCount} (${formatBrExact(overview.verifiedSalesVolume)})` },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums mt-1">
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Global Financial Exposure Control</h3>
                  <p className="text-xs text-slate-500">Posted wallet balances plus remaining daily obligations on active plans.</p>
                </div>
                <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-amber-100 text-amber-800">
                  Financial operations remain controlled by the server
                </span>
              </div>
              {overview.globalExposureCapEtb != null && overview.currentFinancialExposureEtb != null ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Maximum Exposure</p>
                      <p className="text-lg font-extrabold tabular-nums mt-1">{formatBrExact(overview.globalExposureCapEtb)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Current Exposure</p>
                      <p className="text-lg font-extrabold tabular-nums mt-1">{formatBrExact(overview.currentFinancialExposureEtb)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Remaining Capacity</p>
                      <p className="text-lg font-extrabold tabular-nums mt-1">{formatBrExact(overview.remainingFinancialExposureEtb)}</p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="Financial exposure utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, overview.globalExposureCapEtb > 0 ? (overview.currentFinancialExposureEtb / overview.globalExposureCapEtb) * 100 : 0)}>
                    <div
                      className="h-full rounded-full bg-[#D71920]"
                      style={{ width: `${Math.min(100, overview.globalExposureCapEtb > 0 ? (overview.currentFinancialExposureEtb / overview.globalExposureCapEtb) * 100 : 0)}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-700">Exposure data is temporarily unavailable. Do not approve new financial operations until the control is healthy.</p>
              )}
            </div>
          </div>
        )}

        {/* 2. CUSTOMER MANAGEMENT (Zero Wallet Balances or Passwords) */}
        {tab === 'customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Registered Customer Directory</h3>
                <p className="text-xs text-slate-500">
                  Search by phone, referral code, email, or username. View customer data and wallet balances without any balance-editing controls.
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  aria-label="Search customers by phone or referral code"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="e.g., +251911223344 or COLA12345"
                  className="flex-1 sm:w-64 px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => loadTab('customers')}
                  className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold cursor-pointer"
                >
                  Search
                </button>
              </div>
            </div>

            {usersList.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No matching customers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Customer Account</th>
                      <th className="px-4 py-3">Referral Code</th>
                      <th className="px-4 py-3">Invited By</th>
                      <th className="px-4 py-3">Activity Counts</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <p className="font-mono font-bold text-slate-900">{u.phone}</p>
                          {(u.email || u.username) && <p className="mt-0.5 text-[11px] text-slate-500 break-all">{u.email || u.username}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.referralCode}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {u.invitedByPhone ? `${u.invitedByPhone} (${u.invitedByCode})` : 'Direct'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          Plans: <strong>{u.purchasesCount}</strong> · Dep: <strong>{u.depositsCount}</strong> · Wdr: <strong>{u.withdrawalsCount}</strong>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                              u.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(u.id)}
                            className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Profile</span>
                          </button>
                          <button
                            type="button"
                            disabled={customerStatusBusy === u.id}
                            onClick={() => {
                              if (u.status === 'active') {
                                setSuspendTarget({ id: u.id, phone: u.phone });
                                setSuspendReason('');
                              } else {
                                void handleRestoreCustomer(u);
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                              u.status === 'active'
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {customerStatusBusy === u.id ? 'Updating...' : u.status === 'active' ? 'Suspend' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. DEPOSIT REQUESTS */}
        {tab === 'deposits' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900">Deposit Requests Queue</h3>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDepositFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer ${
                      depositFilter === f
                        ? 'bg-[#D71920] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {filteredDeposits.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No deposit requests match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Customer Phone</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Ref / Payment Method</th>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDeposits.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold font-mono text-slate-900">{d.customerPhone}</p>
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums">{formatBrExact(d.amount)}</td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs">{d.txReference}</p>
                          <p className="text-[11px] text-slate-500">
                            {d.methodName} ({d.accountNumberSnapshot})
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {d.hasReceipt && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptPreview({
                                  url: `/api/admin/deposits/${d.id}/receipt`,
                                  mime: d.receiptMime,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                              d.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          {d.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveDeposit(d.id)}
                                className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModal({ kind: 'deposit', id: d.id });
                                  setRejectReason('');
                                }}
                                className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. WITHDRAWAL REQUESTS + SAVED PAYOUT ACCOUNTS */}
        {tab === 'withdrawals' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-slate-900">Withdrawal Requests Queue</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'pending', 'approved', 'processed', 'completed', 'rejected'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setWithdrawalFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer ${
                        withdrawalFilter === f
                          ? 'bg-[#D71920] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {filteredWithdrawals.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No withdrawal requests match this filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Customer Phone</th>
                        <th className="px-4 py-3">Gross / Fee / Net</th>
                        <th className="px-4 py-3">Payout Account</th>
                        <th className="px-4 py-3">Dates &amp; Ref</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredWithdrawals.map((w) => (
                        <tr
                          key={w.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`View withdrawal request from ${w.customerName || w.customerPhone || 'customer'}`}
                          onClick={() => setSelectedWithdrawalId(w.id)}
                          onKeyDown={(event) => {
                            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              setSelectedWithdrawalId(w.id);
                            }
                          }}
                          className="cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D71920]"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {w.customerPhone}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            <p className="font-bold">Gross: {formatBrExact(w.grossAmount)}</p>
                            <p className="text-xs text-slate-500">
                              Fee: {formatBrExact(w.feeAmount)} · Net:{' '}
                              <strong className="text-emerald-700">{formatBrExact(w.netAmount)}</strong>
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-xs">{w.accountOwnerSnapshot}</p>
                            <p className="font-mono text-xs text-slate-600">
                              {w.methodName} · {w.accountNumberSnapshot}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            <p>Req: {new Date(w.createdAt).toLocaleString()}</p>
                            {w.providerReference && (
                              <p className="font-mono text-emerald-700">Ref: {w.providerReference}</p>
                            )}
                            {w.processedAt && (
                              <p className="text-blue-700">Proc: {new Date(w.processedAt).toLocaleDateString()}</p>
                            )}
                            {w.completedAt && (
                              <p className="text-emerald-700">Done: {new Date(w.completedAt).toLocaleDateString()}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                                w.status === 'completed' || w.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : w.status === 'processed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : w.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5" onClick={(event) => event.stopPropagation()}>
                            {w.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveWithdrawal(w.id)}
                                  className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectModal({ kind: 'withdrawal', id: w.id });
                                    setRejectReason('');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                            {w.status === 'approved' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompletionModal({
                                      id: w.id,
                                      targetStatus: 'processed',
                                      currentRef: w.providerReference || '',
                                    });
                                    setCompletionRef(w.providerReference || '');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Mark Processed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompletionModal({
                                      id: w.id,
                                      targetStatus: 'completed',
                                      currentRef: w.providerReference || '',
                                    });
                                    setCompletionRef(w.providerReference || '');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Mark Completed
                                </button>
                              </>
                            )}
                            {w.status === 'processed' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletionModal({
                                    id: w.id,
                                    targetStatus: 'completed',
                                    currentRef: w.providerReference || '',
                                  });
                                  setCompletionRef(w.providerReference || '');
                                }}
                                className="px-3 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                Mark Completed
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">Manual bank payout control</p>
              <p className="mt-1 text-xs leading-5">
                Select any withdrawal request to review the submitted customer, payout account, full account number, amount breakdown, timeline and bank reference. Full bank details are available only in this administrator review view. Mark a withdrawal completed only after the bank transfer is made and its bank reference is recorded.
              </p>
            </div>
          </div>
        )}

        {/* 5. FEEDBACK AND COMPLAINTS */}
        {tab === 'tickets' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900">Customer Inbox</h3>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'unread', 'open', 'in_progress', 'resolved', 'closed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTicketFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer ${
                      ticketFilter === f
                        ? 'bg-[#D71920] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                No customer feedback or complaints match this filter.
              </div>
            ) : (
              filteredTickets.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border p-5 space-y-3 ${
                    !t.isReadByAdmin ? 'border-[#D71920]/40 ring-1 ring-[#D71920]/15' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {!t.isReadByAdmin && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#D71920] text-[10px] font-bold uppercase">
                            Unread
                          </span>
                        )}
                        <p className="font-bold text-slate-900">{t.subject}</p>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Customer Phone: <strong className="font-mono text-slate-800">{t.customerPhone}</strong> ·
                        Category: {t.category} · Submitted: {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateTicketStatus(t.id, { isRead: !t.isReadByAdmin })}
                        className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        {t.isReadByAdmin ? 'Mark Unread' : 'Mark Read'}
                      </button>
                      {t.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateTicketStatus(t.id, { status: 'resolved', isRead: true })}
                          className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl text-xs">
                    {(t.messages || []).map((m) => (
                      <div key={m.id} className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
                          <span className="font-bold text-slate-800">
                            {m.senderRole === 'admin' ? 'Admin Team' : t.customerPhone} ({m.senderRole})
                          </span>
                          <span>{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{m.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      aria-label={`Reply to ${t.subject}`}
                      value={ticketReplies[t.id] || ''}
                      onChange={(e) =>
                        setTicketReplies((p) => ({ ...p, [t.id]: e.target.value }))
                      }
                      placeholder="e.g., Thank you for contacting us. We will review your request."
                      className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleTicketReply(t.id, 'in_progress')}
                      className="px-4 py-2 rounded-full bg-[#D71920] text-white text-xs font-semibold cursor-pointer"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTicketReply(t.id, 'resolved')}
                      className="px-4 py-2 rounded-full bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Reply &amp; Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTicketReply(t.id, 'closed')}
                      className="px-4 py-2 rounded-full bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Reply &amp; Close
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. BROADCAST MESSAGES WITH IMAGE & LIVE PREVIEW */}
        {tab === 'broadcasts' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 space-y-4">
              <form
                onSubmit={handleSendBroadcast}
                className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#D71920]" />
                  <h3 className="font-bold text-sm text-slate-900">Compose Customer Broadcast</h3>
                </div>

                <div>
                  <label htmlFor="brd-target" className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient Audience
                  </label>
                  <select
                    id="brd-target"
                    value={bTargetType}
                    onChange={(e) => setBTargetType(e.target.value as 'all' | 'single')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="all">All Active Customers ({usersList.filter((u) => u.status === 'active').length})</option>
                    <option value="single">Specific Single Customer</option>
                  </select>
                </div>

                {bTargetType === 'single' && (
                  <div>
                    <label htmlFor="brd-customer" className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Customer
                    </label>
                    <select
                      id="brd-customer"
                      value={bTargetUserId}
                      onChange={(e) => setBTargetUserId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-mono"
                      required
                    >
                      <option value="">-- Choose customer phone --</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.phone} ({u.referralCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="brd-title" className="block text-xs font-semibold text-slate-700 mb-1">
                    Announcement Title
                  </label>
                  <input
                    id="brd-title"
                    type="text"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    placeholder="e.g. Scheduled Maintenance or Deposit Bonus Update"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="brd-msg" className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Body
                  </label>
                  <textarea
                    id="brd-msg"
                    value={bMessage}
                    onChange={(e) => setBMessage(e.target.value)}
                    placeholder="Write the message customers will see inside Notifications..."
                    rows={4}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="brd-image" className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional Image Banner (PNG, JPG, WEBP · max 5MB)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="brd-image"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-[#D71920]" />
                      <span>{bImageFile ? bImageFile.name : 'Choose Image File'}</span>
                      <input
                        id="brd-image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setBImageFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                    {bImageFile && (
                      <button
                        type="button"
                        onClick={() => setBImageFile(null)}
                        className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#E11D24] to-[#B80D13] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingBroadcast ? 'Sending Broadcast...' : 'Send Broadcast Now'}</span>
                </button>
              </form>

              {/* Live Customer Preview BEFORE Sending */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Live Customer Notification Preview
                  </h4>
                  <span className="text-[11px] font-semibold text-[#D71920]">
                    Target: {bTargetType === 'all' ? 'All Customers' : selectedCustomerObj?.phone || 'Single Customer'}
                  </span>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {bTitle.trim() || 'Your announcement title appears here'}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#D71920] text-white">
                      Announcement
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap">
                    {bMessage.trim() || 'Your broadcast message body and any image banner will appear inside customer notifications.'}
                  </p>
                  {bImagePreviewUrl && (
                    <img
                      src={bImagePreviewUrl}
                      alt="Broadcast preview"
                      className="w-full max-h-60 object-contain rounded-xl border border-slate-200 bg-white"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Sent Broadcast History */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
                Sent Broadcast History
              </div>
              {broadcasts.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No broadcasts sent yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="p-4 space-y-2 text-xs sm:text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{b.title}</p>
                          <p className="text-xs text-slate-500">
                            Target:{' '}
                            <strong>
                              {b.targetType === 'all'
                                ? `All Customers (${b.recipientCount})`
                                : b.targetPhone || 'Single Customer'}
                            </strong>{' '}
                            · Sent {new Date(b.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{b.message}</p>
                      {b.imageUrl && (
                        <AuthenticatedImage
                          src={b.imageUrl}
                          alt={b.title}
                          className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. PAYMENT SETTINGS MANAGEMENT */}
        {tab === 'payment_methods' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Add Payment Method */}
              <form
                onSubmit={handleCreateMethod}
                className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
              >
                <h3 className="font-bold text-sm text-slate-900">Add Deposit or Payout Method</h3>
                <div>
                  <label htmlFor="pm-kind" className="block text-xs text-slate-600 mb-1">Channel Type</label>
                  <select
                    id="pm-kind"
                    value={pmKind}
                    onChange={(e) => setPmKind(e.target.value as 'deposit' | 'payout')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="deposit">Deposit Method</option>
                    <option value="payout">Withdrawal / Payout Method</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={pmName}
                  onChange={(e) => setPmName(e.target.value)}
                  placeholder="Method Name (e.g. CBE, Telebirr)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
                <input
                  type="text"
                  value={pmAcctName}
                  onChange={(e) => setPmAcctName(e.target.value)}
                  placeholder="e.g., Commercial Bank of Ethiopia"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  value={pmAcctNum}
                  onChange={(e) => setPmAcctNum(e.target.value)}
                  placeholder="e.g., 1000XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  required
                />
                <textarea
                  value={pmInstructions}
                  onChange={(e) => setPmInstructions(e.target.value)}
                  placeholder="e.g., Transfer to this account, then submit your receipt."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-[#D71920] text-white text-sm font-semibold cursor-pointer"
                >
                  Add Payment Method
                </button>
              </form>

              {/* Deposit & Payout Methods List with Inline Edit / Enable / Delete */}
              <div className="lg:col-span-8 space-y-4">
                {[
                  { title: 'Deposit Payment Methods', items: depositMethodsList },
                  { title: 'Withdrawal / Payout Methods', items: payoutMethodsList },
                ].map((group) => (
                  <div key={group.title} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="font-bold text-sm text-slate-900">{group.title}</h3>
                    {group.items.length === 0 ? (
                      <p className="text-xs text-slate-500">No methods configured yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {group.items.map((m) => (
                          <div key={m.id} className="py-3 space-y-2 text-sm">
                            {editingMethodId === m.id ? (
                              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    aria-label="Edit method name"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g., CBE or Telebirr"
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                  />
                                  <input
                                    type="text"
                                    aria-label="Edit account number"
                                    value={editForm.accountNumber}
                                    onChange={(e) => setEditForm((f) => ({ ...f, accountNumber: e.target.value }))}
                                    placeholder="e.g., 1000XXXXXXXX"
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                                  />
                                </div>
                                <input
                                  type="text"
                                  aria-label="Edit account holder"
                                  value={editForm.accountName}
                                  onChange={(e) => setEditForm((f) => ({ ...f, accountName: e.target.value }))}
                                  placeholder="e.g., AK Trading"
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                />
                                <textarea
                                  aria-label="Edit instructions"
                                  value={editForm.instructions}
                                  onChange={(e) => setEditForm((f) => ({ ...f, instructions: e.target.value }))}
                                  rows={2}
                                  placeholder="e.g., Include your transfer reference when submitting proof."
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMethodId(null)}
                                    className="px-3 py-1 rounded-full border border-slate-300 text-xs font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditMethod(m.id)}
                                    className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-bold text-slate-900">{m.name}</p>
                                  <p className="text-xs font-mono text-slate-700">
                                    {m.accountName ? `${m.accountName} · ` : ''}
                                    {m.accountNumber}
                                  </p>
                                  {m.instructions && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{m.instructions}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMethod(m)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                      m.isActive
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {m.isActive ? 'Enabled' : 'Disabled'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMethod(m)}
                                    aria-label={`Edit ${m.name}`}
                                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMethod(m)}
                                    aria-label={`Delete ${m.name}`}
                                    className="p-1.5 rounded-full text-red-600 hover:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Withdrawal Policy Limits & Support Telegram Channels */}
            {settingsForm && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <form
                  onSubmit={handleSaveSettings}
                  className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                >
                  <h3 className="font-bold text-sm text-slate-900">
                    Withdrawal Limits &amp; Platform Policy Settings
                  </h3>
                  <section className="rounded-2xl border border-red-200 bg-red-50/70 p-4 space-y-3">
                    <label className="flex items-start gap-3 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={settingsForm.withdrawalEnabled !== false}
                        onChange={(e) => setSettingsForm({ ...settingsForm, withdrawalEnabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-[#D71920]"
                      />
                      <span>
                        <strong className="block">Enable customer withdrawals</strong>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                          Turning this off blocks new customer withdrawal requests. Existing requests remain available for review and processing.
                        </span>
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="set-withdrawal-start" className="mb-1 block text-xs font-semibold text-slate-600">
                          Opens (Ethiopian clock)
                        </label>
                        <input
                          id="set-withdrawal-start"
                          type="time"
                          step={60}
                          required
                          value={settingsForm.withdrawalStartTime || '04:00'}
                          onChange={(e) => setSettingsForm({ ...settingsForm, withdrawalStartTime: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Example: 04:00 (24-hour Ethiopian clock)</p>
                      </div>
                      <div>
                        <label htmlFor="set-withdrawal-end" className="mb-1 block text-xs font-semibold text-slate-600">
                          Closes (Ethiopian clock)
                        </label>
                        <input
                          id="set-withdrawal-end"
                          type="time"
                          step={60}
                          required
                          value={settingsForm.withdrawalEndTime || '11:00'}
                          onChange={(e) => setSettingsForm({ ...settingsForm, withdrawalEndTime: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Example: 11:00 (24-hour Ethiopian clock)</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#9E1720]">
                      Customer schedule: {withdrawalWindowLabel(settingsForm.withdrawalStartTime || '04:00', settingsForm.withdrawalEndTime || '11:00')}
                    </p>
                  </section>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="set-min-w" className="block text-xs text-slate-500 mb-1">
                        Minimum Withdrawal (Br)
                      </label>
                      <input
                        id="set-min-w"
                        type="number"
                        placeholder="e.g., 150"
                        value={settingsForm.minWithdrawal}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, minWithdrawal: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="set-fee-w" className="block text-xs text-slate-500 mb-1">
                        Withdrawal Fee (%)
                      </label>
                      <input
                        id="set-fee-w"
                        type="number"
                        placeholder="e.g., 20"
                        value={settingsForm.withdrawalFeePercent}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            withdrawalFeePercent: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="set-plim" className="block text-xs text-slate-500 mb-1">
                        Active Purchase Limit
                      </label>
                      <input
                        id="set-plim"
                        type="number"
                        placeholder="e.g., 1"
                        value={settingsForm.purchaseLimit}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, purchaseLimit: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="set-regb" className="block text-xs text-slate-500 mb-1">
                        Registration Bonus (Br)
                      </label>
                      <input
                        id="set-regb"
                        type="number"
                        placeholder="e.g., 150"
                        value={settingsForm.registrationBonus}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            registrationBonus: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="set-privacy-policy" className="block text-xs font-semibold text-slate-600 mb-1">
                        Public Privacy Policy URL (HTTPS)
                      </label>
                      <input
                        id="set-privacy-policy"
                        type="url"
                        inputMode="url"
                        value={settingsForm.privacyPolicyUrl || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, privacyPolicyUrl: e.target.value.trim() })}
                        placeholder="https://your-company.example/privacy-policy"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Add the public link to your already approved company Privacy Policy. It will appear on login, registration, and signed-in pages. Only HTTPS links are accepted.
                      </p>
                    </div>
                    <label className="col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsForm.promotionalRewardsEnabled)}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            promotionalRewardsEnabled: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 accent-[#D71920]"
                      />
                      <span>
                        <strong className="block">Enable Registration Bonus and Daily Check-in rewards</strong>
                        When enabled, new users receive {settingsForm.registrationBonus} ETB and eligible users can claim {settingsForm.dailyCheckinAmount ?? 2} ETB each Ethiopia calendar day. These are real wallet credits and create funding liabilities. Enable only after the reward budget and customer terms are approved and funded.
                      </span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-full bg-[#D71920] text-white text-sm font-semibold cursor-pointer"
                  >
                    Save Policy Settings
                  </button>
                </form>

                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h3 className="font-bold text-sm text-slate-900">Customer Service Telegram Channels</h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {channels.map((ch) => (
                      <div key={ch.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">{ch.label}</p>
                          <p className="font-mono text-slate-500">{ch.handleOrUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setErrorMsg('');
                            try {
                              await apiFetch(`/api/admin/channels/${ch.id}`, { method: 'DELETE' });
                              await refreshConfig();
                              await loadTab('payment_methods');
                            } catch (err: any) {
                              setErrorMsg(err?.message || 'Failed to delete channel.');
                            }
                          }}
                          className="text-red-600 font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddChannel} className="space-y-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={chLabel}
                      onChange={(e) => setChLabel(e.target.value)}
                      placeholder="e.g., Customer Support"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                    <input
                      type="text"
                      value={chHandle}
                      onChange={(e) => setChHandle(e.target.value)}
                      placeholder="e.g., @Coca_cola_Customer_service1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                    <input
                      type="url"
                      value={chHref}
                      onChange={(e) => setChHref(e.target.value)}
                      placeholder="https://t.me/..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full py-2 rounded-full bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Add Support Channel
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. GIFT CODE MANAGEMENT (WALLET REWARDS) */}
        {tab === 'gift_codes' && (
          <div className="space-y-5">
            {/* Global Feature Toggle Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#D71920]" />
                  <h3 className="font-bold text-base text-slate-900">
                    Gift Code Feature Status:{' '}
                    <span className={giftCodeEnabled ? 'text-emerald-700' : 'text-slate-600'}>
                      {giftCodeEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  When disabled, the Gift Code button is completely hidden from all customer dashboards and API redemption is blocked.
                  All gift codes award non-cash <strong>ETB</strong> only.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="admin-enable-gift-code-btn"
                  disabled={giftCodeEnabled}
                  onClick={() => handleToggleGiftFeature(true)}
                  className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-45 cursor-pointer"
                >
                  Enable Gift Code
                </button>
                <button
                  type="button"
                  data-testid="admin-disable-gift-code-btn"
                  disabled={!giftCodeEnabled}
                  onClick={() => handleToggleGiftFeature(false)}
                  className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-45 cursor-pointer"
                >
                  Disable Gift Code
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Create & Publish Gift Code Form */}
              <form
                onSubmit={handleCreateGiftCode}
                className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
              >
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D71920]" />
                  <span>Create &amp; Publish Gift Code</span>
                </h3>
                <div>
                  <label htmlFor="gc-code" className="block text-xs font-semibold text-slate-600 mb-1">
                    Gift Code (3–32 chars)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="gc-code"
                      type="text"
                      value={gcCode}
                      onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                      placeholder="e.g., COLA-500"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono uppercase"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerateGiftCode}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="gc-reward" className="block text-xs font-semibold text-slate-600 mb-1">
                    Reward Amount (ETB)
                  </label>
                  <input
                    id="gc-reward"
                    type="number"
                    min="1"
                    step="1"
                    value={gcRewardAmount}
                    onChange={(e) => setGcRewardAmount(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="gc-max" className="block text-xs font-semibold text-slate-600 mb-1">
                      Max Redemptions (optional)
                    </label>
                    <input
                      id="gc-max"
                      type="number"
                      min="1"
                      step="1"
                      value={gcMaxRedemptions}
                      onChange={(e) => setGcMaxRedemptions(e.target.value)}
                      placeholder="e.g., 100 (leave blank for unlimited)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="gc-exp" className="block text-xs font-semibold text-slate-600 mb-1">
                      Expiry Date/Time (optional)
                    </label>
                    <input
                      id="gc-exp"
                      type="datetime-local"
                      value={gcExpiresAt}
                      onChange={(e) => setGcExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">Choose the date and time when this gift code expires.</p>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={gcSubmitting}
                  className="w-full py-2.5 rounded-full bg-[#D71920] hover:bg-[#B80D13] text-white text-sm font-bold disabled:opacity-60 cursor-pointer"
                >
                  {gcSubmitting ? 'Publishing...' : 'Create & Publish Gift Code'}
                </button>
              </form>

              {/* All Created Gift Codes */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Created Gift Codes ({giftCodes.length})
                </h3>
                {giftCodes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No gift codes created yet. Create one to reward customers with ETB.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {giftCodes.map((g) => {
                      const isExpired = Boolean(g.expiresAt && new Date(g.expiresAt).getTime() <= Date.now());
                      const isLimitReached =
                        g.maxRedemptions !== null && g.redemptionCount >= g.maxRedemptions;
                      const statusText = !g.isActive
                        ? 'Deactivated'
                        : isExpired
                        ? 'Expired'
                        : isLimitReached
                        ? 'Limit Reached'
                        : 'Active';
                      const badgeCls =
                        statusText === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700';

                      return (
                        <div key={g.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-sm text-slate-900">
                                {g.code}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${badgeCls}`}>
                                {statusText}
                              </span>
                            </div>
                            <p className="text-slate-600">
                              Reward: <strong>{formatEtb(g.rewardAmount)}</strong> · Redemptions:{' '}
                              <strong className="tabular-nums">
                                {g.redemptionCount}
                                {g.maxRedemptions !== null ? ` / ${g.maxRedemptions}` : ' / Unlimited'}
                              </strong>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Created {new Date(g.createdAt).toLocaleString()}
                              {g.expiresAt ? ` · Expires ${new Date(g.expiresAt).toLocaleString()}` : ''}
                            </p>
                          </div>
                          {g.isActive && (
                            <button
                              type="button"
                              onClick={() => handleDeactivateGiftCode(g)}
                              className="px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold cursor-pointer"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Redemption History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">
                Gift Code Redemption History ({giftRedemptions.length})
              </h3>
              {giftRedemptions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No customers have redeemed a gift code yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                  {giftRedemptions.map((r) => (
                    <div key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{r.code}</span>
                        <span className="text-slate-500 ml-2">
                          redeemed by <strong className="font-mono">{r.customerPhone || 'Customer'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-700 tabular-nums">
                          +{formatEtb(r.rewardAmount)}
                        </span>
                        <span className="font-mono text-slate-400">
                          {new Date(r.redeemedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. ADMIN ACTIVITY / AUDIT LOG */}
        {tab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#D71920]" />
              <span>Admin Activity &amp; Security Audit Log</span>
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No admin audit actions recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 uppercase">{log.action}</span>{' '}
                      <span className="text-slate-600">
                        ({log.target_type} · <span className="font-mono">{log.target_id}</span>)
                      </span>{' '}
                      <span className="text-slate-500">
                        by {log.actor_name || 'System'} ({log.actor_role || 'n/a'})
                      </span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
        </div>
      </div>

      {/* Withdrawal Request Details Modal */}
      {selectedWithdrawal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Withdrawal Request Details"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedWithdrawalId(null)}
        >
          <section
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide font-bold text-[#D71920]">Administrator review</p>
                <h3 className="text-lg font-extrabold text-slate-900">Withdrawal Request Details</h3>
                <p className="mt-1 text-xs text-slate-500 font-mono break-all">{selectedWithdrawal.id}</p>
              </div>
              <button
                type="button"
                aria-label="Close withdrawal details"
                onClick={() => setSelectedWithdrawalId(null)}
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Customer name</p>
                <p className="font-bold text-slate-900 break-words">{selectedWithdrawal.customerName || 'Not provided'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Customer phone</p>
                <p className="font-bold text-slate-900 font-mono">{selectedWithdrawal.customerPhone || 'Not available'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Payout method</p>
                <p className="font-bold text-slate-900">{selectedWithdrawal.methodName}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Account owner</p>
                <p className="font-bold text-slate-900 break-words">{selectedWithdrawal.accountOwnerSnapshot}</p>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] text-amber-800">Bank account number · confidential</p>
                <p className="font-mono font-extrabold text-slate-900 break-all select-all">{selectedWithdrawal.accountNumberSnapshot}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Gross amount</p>
                <p className="font-extrabold text-slate-900 tabular-nums">{formatBrExact(selectedWithdrawal.grossAmount)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">Withdrawal fee</p>
                <p className="font-extrabold text-red-700 tabular-nums">{formatBrExact(selectedWithdrawal.feeAmount)}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] text-emerald-800">Net payout</p>
                <p className="font-extrabold text-emerald-800 tabular-nums">{formatBrExact(selectedWithdrawal.netAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Request submitted</p>
                <p className="font-semibold text-slate-800">{new Date(selectedWithdrawal.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Current status</p>
                <p className="font-bold uppercase text-slate-900">{selectedWithdrawal.status}</p>
              </div>
              {selectedWithdrawal.providerReference && (
                <div>
                  <p className="text-slate-500">Bank transfer reference</p>
                  <p className="font-mono font-bold text-emerald-700 break-all">{selectedWithdrawal.providerReference}</p>
                </div>
              )}
              {selectedWithdrawal.reviewedAt && (
                <div>
                  <p className="text-slate-500">Reviewed at</p>
                  <p className="font-semibold text-slate-800">{new Date(selectedWithdrawal.reviewedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedWithdrawal.processedAt && (
                <div>
                  <p className="text-slate-500">Processed at</p>
                  <p className="font-semibold text-slate-800">{new Date(selectedWithdrawal.processedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedWithdrawal.completedAt && (
                <div>
                  <p className="text-slate-500">Completed at</p>
                  <p className="font-semibold text-slate-800">{new Date(selectedWithdrawal.completedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedWithdrawal.rejectionReason && (
                <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-slate-500">Rejection reason</p>
                  <p className="font-semibold text-red-800">{selectedWithdrawal.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              {selectedWithdrawal.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedWithdrawal.id;
                      setSelectedWithdrawalId(null);
                      void handleApproveWithdrawal(id);
                    }}
                    className="px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Approve request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModal({ kind: 'withdrawal', id: selectedWithdrawal.id });
                      setRejectReason('');
                      setSelectedWithdrawalId(null);
                    }}
                    className="px-4 py-2 rounded-full bg-red-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Reject request
                  </button>
                </>
              )}
              {selectedWithdrawal.status === 'approved' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletionModal({ id: selectedWithdrawal.id, targetStatus: 'processed', currentRef: selectedWithdrawal.providerReference || '' });
                      setCompletionRef(selectedWithdrawal.providerReference || '');
                      setSelectedWithdrawalId(null);
                    }}
                    className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark processed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletionModal({ id: selectedWithdrawal.id, targetStatus: 'completed', currentRef: selectedWithdrawal.providerReference || '' });
                      setCompletionRef(selectedWithdrawal.providerReference || '');
                      setSelectedWithdrawalId(null);
                    }}
                    className="px-4 py-2 rounded-full bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark completed
                  </button>
                </>
              )}
              {selectedWithdrawal.status === 'processed' && (
                <button
                  type="button"
                  onClick={() => {
                    setCompletionModal({ id: selectedWithdrawal.id, targetStatus: 'completed', currentRef: selectedWithdrawal.providerReference || '' });
                    setCompletionRef(selectedWithdrawal.providerReference || '');
                    setSelectedWithdrawalId(null);
                  }}
                  className="px-4 py-2 rounded-full bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Mark completed
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedWithdrawalId(null)}
                className="px-4 py-2 rounded-full border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Customer Detail Profile Modal */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        onStatusChanged={() => void loadTab('customers')}
      />

      {/* Protected Receipt Viewer Modal */}
      {receiptPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment Receipt Preview"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Payment Receipt Evidence</h3>
              <button
                type="button"
                aria-label="Close receipt preview"
                onClick={() => setReceiptPreview(null)}
                className="cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AuthenticatedImage
              src={receiptPreview.url}
              mimeHint={receiptPreview.mime}
              alt="Customer payment receipt"
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-100"
            />
          </div>
        </div>
      )}

      {/* Withdrawal Processed / Completed Modal */}
      {completionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update Withdrawal Completion Status"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmWithdrawalComplete}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Mark Withdrawal as {completionModal.targetStatus === 'processed' ? 'Processed' : 'Completed'}
            </h3>
            <p className="text-xs text-slate-600">
              {completionModal.targetStatus === 'processed'
                ? 'Use this when the manual bank transfer has been initiated and is being processed. Enter its bank reference. Funds remain reserved and the withdrawal is not completed yet.'
                : 'Use this only after the bank confirms the transfer succeeded. Enter the final bank reference. This releases the reserved amount and records the withdrawal as completed.'}
            </p>
            <input
              type="text"
              value={completionRef}
              onChange={(e) => setCompletionRef(e.target.value)}
              placeholder="Bank Transaction Short Code (min 4 characters)"
              minLength={4}
              required
              autoComplete="off"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCompletionModal(null)}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completionRef.trim().length < 4}
                className="flex-1 py-2.5 rounded-full bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm {completionModal.targetStatus === 'processed' ? 'Processed' : 'Completed'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm customer suspension with a required reason */}
      {suspendTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm customer suspension"
          className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmSuspendCustomer}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Confirm Customer Suspension</h3>
            <p className="text-sm text-slate-600">
              You are about to suspend <strong className="font-mono text-slate-900">{suspendTarget.phone}</strong>.
              This will prevent the customer from signing in until the account is restored.
            </p>
            <label htmlFor="customer-suspension-reason" className="block text-xs font-semibold text-slate-700">
              Reason for suspension (required)
            </label>
            <textarea
              id="customer-suspension-reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Explain why this customer account must be suspended (minimum 8 characters)"
              rows={3}
              minLength={8}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={customerStatusBusy === suspendTarget.id}
                onClick={() => { setSuspendTarget(null); setSuspendReason(''); }}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={customerStatusBusy === suspendTarget.id || suspendReason.trim().length < 8}
                className="flex-1 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {customerStatusBusy === suspendTarget.id ? 'Suspending...' : 'Confirm Suspend'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Provide Rejection Reason"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Provide Rejection Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this request is being rejected (visible to customer)..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              required
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold cursor-pointer"
              >
                Confirm Reject
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
