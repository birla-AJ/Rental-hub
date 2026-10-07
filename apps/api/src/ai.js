// The "AI verification" assistant: talks to the tenant and the owner on WhatsApp, understands their replies, and feeds the
// results into the same checkout rules as the app (dual confirmation is still required before a room becomes vacant).
import * as defaultCore from '../../../packages/core/src/index.js';

const H = 3600e3;
export function createAi({ db, core = defaultCore, provider, notify, notifyRole, advance, cfg = {} }) {
  const C = { remindMs: 6 * H, escalateMs: 48 * H, maxAsks: 2, ...cfg };   // timings are assumptions — the plan doesn't specify them
  const first = (n) => String(n ?? '').split(' ')[0];
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
  const user = (id) => db.users.find((u) => u.id === id);
  const prop = (room) => db.properties[room.propertyId];
  const nextId = () => 'cv' + (Math.max(0, ...Object.keys(db.conversations).map((k) => +k.slice(2) || 0)) + 1);
  const open = (roomId, party) => Object.values(db.conversations).find((c) => c.roomId === roomId && c.party === party && c.status === 'OPEN');

  function say(conv, text) {
    const m = { dir: 'out', text, at: new Date().toISOString() }; conv.messages.push(m);
    Promise.resolve().then(() => provider.send({ to: conv.phone, text })).then((r) => { m.pid = r?.id; }).catch((e) => { m.failed = true; console.error('[whatsapp] send failed:', e.message); });
  }
  function start(room, party, text) {
    if (open(room.id, party)) return open(room.id, party);
    const u = user(party === 'owner' ? room.ownerId : room.tenantId);
    const phone = u?.phone ?? (party === 'owner' ? prop(room)?.ownerPhone : null); if (!phone) return null;
    const conv = { id: nextId(), roomId: room.id, party, phone, status: 'OPEN', attempts: 0, requestedAt: new Date().toISOString(), remindedAt: null, messages: [] };
    db.conversations[conv.id] = conv; say(conv, text); return conv;
  }
  const done = (conv, outcome) => { if (conv && conv.status === 'OPEN') { conv.status = 'DONE'; conv.outcome = outcome; conv.closedAt = new Date().toISOString(); } };

  // ----- called by the app's checkout routes -----
  const onScan = (room) => start(room, 'tenant', `Hi ${first(user(room.tenantId)?.name)}, we got your checkout request for ${room.name}. Please reply with your move-out date (for example 5 Oct), or confirm it in the app. This activates your cashback.`);
  function onTenantConfirmed(room, k) {
    done(open(room.id, 'tenant'), 'CONFIRMED_IN_APP');
    start(room, 'owner', `Hi ${first(user(room.ownerId)?.name ?? prop(room)?.ownerName)}, ${first(user(room.tenantId)?.name)} says they are moving out of ${room.name} (${prop(room)?.name}) on ${fmt(k.tenant.checkoutDate)}. Reply YES to confirm, NO if this is wrong, or send the correct date.`);
  }
  const onOwnerAnsweredInApp = (room) => done(open(room.id, 'owner'), 'ANSWERED_IN_APP');

  // ----- called after every checkout state change -----
  function settle(room, k) {
    const convs = Object.values(db.conversations).filter((c) => c.roomId === room.id);
    const talk = (party, text, outcome) => { const c = convs.find((x) => x.party === party && (x.status === 'OPEN' || x.outcome)); if (c) { if (c.status === 'OPEN') done(c, outcome); say(c, text); } };
    if (k.state === 'VERIFIED') {
      talk('tenant', `Your checkout from ${room.name} is verified. Your cashback is now ready to use on your next booking.`, 'VERIFIED');
      talk('owner', `Thank you! ${room.name} is now marked vacant. We'll look for a new tenant — you pay nothing unless we place one. If it takes more than 7 days, no commission is charged.`, 'VERIFIED');
    } else if (k.state === 'DISPUTED' || k.state === 'MANUAL_REVIEW') {
      for (const p of ['tenant', 'owner']) talk(p, 'Thanks. The details need a quick check, so our team will review them and get back to you.', k.state);
    } else if (k.state === 'REJECTED') {
      for (const p of ['tenant', 'owner']) talk(p, `After review, the checkout for ${room.name} was not approved, so nothing has changed. Contact us if you have questions.`, 'REJECTED');
    }
  }

  // ----- incoming WhatsApp message -----
  function handleInbound({ id, from, text }, now = new Date()) {
    if (id && Object.values(db.conversations).some((c) => c.messages.some((m) => m.dir === 'in' && m.pid === id))) return { duplicate: true };   // providers retry webhooks
    const conv = Object.values(db.conversations).filter((c) => c.status === 'OPEN' && c.phone === from).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
    if (!conv) return { ignored: true };
    conv.messages.push({ dir: 'in', text: String(text).slice(0, 500), at: now.toISOString(), pid: id });
    const room = db.rooms[conv.roomId]; let k = db.checkouts[conv.roomId];
    if (!k || ['VERIFIED', 'REJECTED'].includes(k.state)) { done(conv, 'CLOSED'); return { ignored: true }; }
    const r = core.parseReply(text, now);
    const unclear = () => {
      conv.attempts++;
      if (conv.attempts > C.maxAsks) { done(conv, 'ESCALATED'); const k2 = core.escalate(k, { reason: 'unclear_replies', now }); advance(room, k2, { verify: false }); return { intent: 'UNCLEAR', escalated: true }; }
      say(conv, conv.party === 'owner' ? `Sorry, I didn't catch that. Please reply YES to confirm the move-out on ${fmt(k.tenant.checkoutDate)}, NO if it's wrong, or send the correct date (like 5 Oct).` : `Sorry, I didn't catch that. Please send your move-out date (like 5 Oct).`);
      return { intent: 'UNCLEAR' };
    };
    if (conv.party === 'owner') {
      if (!k.tenant) return { ignored: true };
      if (r.intent === 'UNCLEAR') return unclear();
      if (r.intent === 'DATE' && !core.plausibleCheckoutDate(r.date, now)) return unclear();
      const confirmed = r.intent !== 'REJECT', date = r.intent === 'DATE' ? r.date : k.tenant.checkoutDate;
      done(conv, confirmed ? 'CONFIRMED' : 'REJECTED');
      k = core.ownerRespond(k, { confirmed, checkoutDate: date, now }); advance(room, k, { now });
      return { intent: r.intent, state: db.checkouts[room.id].state };
    }
    // tenant: only a date counts (a bare YES gives us no date), and only after the QR scan
    if (r.intent !== 'DATE' || !core.plausibleCheckoutDate(r.date, now)) return unclear();
    if (!k.qrScannedAt) { say(conv, 'Please scan the QR tag on your room in the app first — this is needed to activate your cashback.'); return { needsQr: true }; }
    k = core.tenantConfirm(k, { checkoutDate: r.date, now }); db.checkouts[room.id] = k;
    notify(room.ownerId, 'CHECKOUT', 'Checkout request', `${room.name}: your tenant says they are moving out. Please confirm or tell us if it's wrong.`);
    onTenantConfirmed(room, k); advance(room, k, { now });
    return { intent: 'DATE', state: db.checkouts[room.id].state };
  }

  // ----- timers: remind, then hand over to a person -----
  function sweep(now = new Date()) {
    let reminded = 0, escalated = 0;
    for (const conv of Object.values(db.conversations)) {
      if (conv.status !== 'OPEN') continue; const age = +now - +new Date(conv.requestedAt), room = db.rooms[conv.roomId], k = db.checkouts[conv.roomId];
      if (!k || ['VERIFIED', 'REJECTED', 'MANUAL_REVIEW'].includes(k.state)) { done(conv, 'CLOSED'); continue; }
      if (age >= C.escalateMs) {
        done(conv, 'TIMED_OUT'); escalated++; advance(room, core.escalate(k, { reason: `no_reply_${conv.party}`, now }), { verify: false, now });
        notifyRole('admin', 'ALERT', 'No reply to checkout request', `${room.name}: ${conv.party} did not reply in time.`);
      } else if (age >= C.remindMs && !conv.remindedAt) {
        conv.remindedAt = now.toISOString(); reminded++;
        say(conv, conv.party === 'owner' ? `Reminder: ${first(user(room.tenantId)?.name)}'s move-out from ${room.name} on ${fmt(k.tenant?.checkoutDate)} is waiting for your reply. YES / NO / correct date.` : `Reminder: please send your move-out date for ${room.name} (like 5 Oct) or confirm it in the app.`);
      }
    }
    return { reminded, escalated };
  }
  return { onScan, onTenantConfirmed, onOwnerAnsweredInApp, settle, handleInbound, sweep, config: C };
}
