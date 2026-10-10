// Role-based navigation + page config. Same web app for Admin / Agent / Owner.
const T = (title, sub, path, o = {}) => ({ title, sub, path, ...o });
export const PAGES = {
  properties: T('Properties', 'Every registered property. Open a pending one to assign an agent, send it back or reject it. Verification itself is done in person by the agent.', '/admin/properties', { chips: ['status'], tabBy: 'status',
    actions: [
      { label: 'Assign agent', choicesPath: '/admin/agents', when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/assign`, body: (_, agentId) => ({ agentId }) },
      { label: 'Send back for revisit', reason: true, when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/revisit` },
      { label: 'Reject property', reason: true, when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/reject` }] }),
  rooms: T('Rooms', 'Each room, its status and QR tag.', '/admin/rooms', { money: ['rent'], chips: ['status'], tabBy: 'status' }),
  bookings: T('Bookings', 'Tenant bookings from request to move-in. Open a row to confirm, reject or mark moved-in.', '/admin/bookings', { money: ['payable', 'cashback'], chips: ['status'], tabBy: 'status', empty: 'No bookings yet.',
    actions: [
      { label: 'Confirm booking', when: (r) => r.status === 'PENDING', path: (r) => `/bookings/${r.id}/confirm` },
      { label: 'Mark moved in', when: (r) => r.status === 'CONFIRMED', path: (r) => `/bookings/${r.id}/movein` },
      { label: 'Reject & refund', reason: true, when: (r) => ['PENDING', 'CONFIRMED'].includes(r.status), path: (r) => `/bookings/${r.id}/reject` }] }),
  kyc: T('KYC', 'Identity checks. Only the ID type is stored — never the ID number.', '/admin/kyc', { chips: ['status'], tabBy: 'status', empty: 'No KYC submissions yet.',
    actions: [
      { label: 'Verify', when: (r) => r.status === 'PENDING', path: (r) => `/kyc/${r.id}/verify` },
      { label: 'Reject', reason: true, when: (r) => r.status === 'PENDING', path: (r) => `/kyc/${r.id}/reject` }] }),
  whatsapp: T('WhatsApp / AI verification', 'What our assistant sent and what the tenant and owner replied. Phone numbers are masked.', '/admin/conversations', { chips: ['status'], tabBy: 'status', empty: 'No conversations yet.' }),
  review: T('Checkout review', 'Every checkout and its state. Open a row in Manual review or Disputed to approve or reject the exit.', '/admin/checkouts', { chips: ['status'], tabBy: 'status', empty: 'No checkouts yet.',
    actions: [
      { label: 'Approve exit', when: (r) => ['MANUAL_REVIEW', 'DISPUTED'].includes(r.status), path: (r) => `/checkout/${r.id}/resolve`, body: () => ({ approve: true, note: 'Approved by admin' }) },
      { label: 'Reject exit', reason: true, when: (r) => ['MANUAL_REVIEW', 'DISPUTED'].includes(r.status), path: (r) => `/checkout/${r.id}/resolve`, body: (reason) => ({ approve: false, note: reason }) }] }),
  staff: T('Staff', 'Admins and agents. Staff are added here — nobody can sign up as staff on their own.', '/admin/staff', { chips: ['status'], tabBy: 'status', empty: 'No staff yet.',
    actions: [
      { label: 'Deactivate (blocks access immediately)', when: (r) => r.status === 'ACTIVE', path: (r) => `/staff/${r.id}/deactivate` },
      { label: 'Reactivate', when: (r) => r.status === 'DISABLED', path: (r) => `/staff/${r.id}/reactivate` }] }),
  notifications: T('Notifications', 'Platform alerts: new registrations, verification, bookings, payments, system.', '/admin/notifications', { empty: 'No notifications yet.' }),
  users: T('Users', 'Tenants, owners and agents.', '/admin/users', { chips: ['kyc'], tabBy: 'role' }),
  verification: T('Verification', 'Property verification queue.', '/admin/properties', { chips: ['status'], tabBy: 'status',
    actions: [
      { label: 'Assign agent', choicesPath: '/admin/agents', when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/assign`, body: (_, agentId) => ({ agentId }) },
      { label: 'Send back for revisit', reason: true, when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/revisit` },
      { label: 'Reject property', reason: true, when: (r) => r.status === 'PENDING_VERIFICATION', path: (r) => `/properties/${r.id}/reject` }] }),
  vacancy: T('Vacancy', 'Rooms in their 7-day placement window.', '/admin/vacancy', { chips: ['phase'], empty: 'No vacant rooms right now.' }),
  placement: T('Placement', 'Placement outcomes. Waived = platform kept its fee, nothing paid to owners.', '/admin/commissions', { money: ['amount', 'waivedValue'], chips: ['status'], empty: 'No placements yet.' }),
  cashback: T('Cashback', 'Tokens and their state. Inactivity date is internal only.', '/admin/cashback', { money: ['amount'], chips: ['state'] }),
  commission: T('Commission', 'Due, paid and waived commission.', '/admin/commissions', { money: ['amount', 'waivedValue'], chips: ['status'], tabBy: 'status', empty: 'No commission yet.' }),
  payments: T('Payments', 'Commission payments received.', '/admin/commissions', { money: ['amount'], chips: ['status'], empty: 'No payments yet.' }),
  qr: T('QR tags', 'Room tags assigned by agents.', '/admin/qr', { chips: ['status'], empty: 'No QR tags yet.' }),
  'ai-logs': T('AI verification logs', 'Tenant ↔ owner checkout cross-verification trail.', '/admin/ai-logs', { empty: 'No checkouts yet.' }),
  audit: T('Audit logs', 'Who changed what, and when.', '/admin/audit', { empty: 'No activity yet.' }),
  browse: T('Browse Homes', 'Verified homes and rooms available for rent in Indore.', '/listings', { empty: 'No homes listed yet. Check back soon or register a home.' }),
};
export const NAV = {
  admin: [['dashboard', 'Dashboard', 'dashboard'], ['properties', 'Properties', 'building'], ['rooms', 'Rooms', 'door'], ['users', 'Users', 'users'], ['staff', 'Staff', 'users'], ['bookings', 'Bookings', 'calendar'], ['verification', 'Verification', 'check'], ['kyc', 'KYC', 'id'], ['vacancy', 'Vacancy', 'clock'],
    ['placement', 'Placement', 'users'], ['cashback', 'Cashback', 'wallet'], ['commission', 'Commission', 'briefcase'], ['payments', 'Payments', 'card'], ['qr', 'QR tags', 'tag'], ['review', 'Checkout review', 'search'], ['whatsapp', 'WhatsApp', 'message'], ['ai-logs', 'AI logs', 'sparkles'], ['reports', 'Reports', 'chart'], ['notifications', 'Notifications', 'bell'], ['audit', 'Audit logs', 'file'], ['settings', 'Settings', 'settings']],
  agent: [['dashboard', 'Dashboard', 'dashboard'], ['properties', 'Assigned properties', 'building'], ['verification', 'Verification', 'check'], ['qr', 'QR tags', 'tag']],
  owner: [['dashboard', 'Dashboard', 'dashboard'], ['rooms', 'Rooms', 'door'], ['vacancy', 'Vacancy', 'clock'], ['commission', 'Commission', 'briefcase']],
  tenant: [['browse', 'Find Homes', 'building'], ['bookings', 'My Bookings', 'calendar'], ['notifications', 'Notifications', 'bell']],
};
