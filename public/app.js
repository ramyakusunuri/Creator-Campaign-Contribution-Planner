/**
 * public/app.js
 * 
 * Frontend client for C24 Promo Dashboard.
 * Uses native fetch + ReadableStream reader to consume SSE events with custom X-Brand-Key header.
 * Strictly formats dates to Indian Standard Time (IST, UTC+05:30).
 */

const BRAND_KEYS = {
  B1: 'demo-key-b1',
  B2: 'demo-key-b2'
};

let currentBrandId = 'B1';
let currentBrandKey = BRAND_KEYS['B1'];
let streamAbortController = null;
let reconnectTimer = null;
let periodicRefreshTimer = null;

// Helper: Format Date in IST (+05:30)
function formatIST(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' IST';
  } catch {
    return isoStr;
  }
}

// Helper: Convert Date to local datetime-local input string in IST
function toDatetimeLocalIST(d = new Date()) {
  // Convert UTC time to IST ms
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5));
  return istDate.toISOString().slice(0, 16);
}

// Helper: Format INR currency
function formatINR(amount) {
  if (amount === null || amount === undefined) {
    return '<span class="text-dim">Unknown</span>';
  }
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Status Indicator UI
function setConnectionStatus(status, text) {
  const el = document.getElementById('connection-status');
  const label = document.getElementById('connection-text');
  el.className = 'status-indicator ' + status;
  label.textContent = text;
}

// 1. Load Creators Dropdown
async function loadCreators() {
  const select = document.getElementById('select-creator');
  try {
    const res = await fetch(`/brands/${currentBrandId}/creators`, {
      headers: { 'X-Brand-Key': currentBrandKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    select.innerHTML = '<option value="" disabled selected>Select an eligible creator</option>';
    for (const c of data.creators) {
      const opt = document.createElement('option');
      opt.value = c.creator_id;
      if (!c.eligible) {
        opt.disabled = true;
        opt.textContent = `${c.name} (${c.creator_id}) - [BLOCKED: ${c.reason}]`;
      } else {
        opt.textContent = `${c.name} (${c.creator_id}) - Eligible`;
      }
      select.appendChild(opt);
    }
  } catch (err) {
    console.error('Failed to load creators:', err);
    select.innerHTML = '<option value="" disabled>Error loading creators</option>';
  }
}

// 2. Load Registered Promo Codes
async function loadPromoCodes() {
  const tbody = document.getElementById('promo-codes-tbody');
  try {
    const res = await fetch(`/brands/${currentBrandId}/promo-codes`, {
      headers: { 'X-Brand-Key': currentBrandKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const codes = data.promo_codes || [];

    if (codes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-6">No promo codes registered yet. Create one above!</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    for (const p of codes) {
      const tr = document.createElement('tr');
      
      let badgeClass = 'badge-valid';
      if (p.status === 'not_yet_valid') badgeClass = 'badge-not-yet';
      if (p.status === 'expired') badgeClass = 'badge-expired';

      tr.innerHTML = `
        <td><strong class="font-mono text-accent">${p.code}</strong></td>
        <td>${p.creator_id}</td>
        <td>
          <div class="text-[11px] font-mono leading-tight">
            <div>${formatIST(p.valid_from)}</div>
            <div class="text-dim">to ${formatIST(p.valid_to)}</div>
          </div>
        </td>
        <td><span class="badge ${badgeClass}">${p.status.replace(/_/g, ' ')}</span></td>
        <td class="text-right font-mono font-bold">${p.use_count}</td>
        <td class="text-right font-mono">${p.units}</td>
        <td class="text-right font-mono">${formatINR(p.gross_inr)}</td>
        <td>
          <button class="btn-sm btn-outline edit-dates-btn" data-code="${p.code}" data-from="${p.valid_from}" data-to="${p.valid_to}">
            Edit Dates
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Attach edit handlers
    document.querySelectorAll('.edit-dates-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        openPatchModal(
          target.getAttribute('data-code'),
          target.getAttribute('data-from'),
          target.getAttribute('data-to')
        );
      });
    });
  } catch (err) {
    console.error('Failed to load promo codes:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error loading promo codes: ${err.message}</td></tr>`;
  }
}

// 3. Load Unregistered Uses & Feed Status
async function loadFeedStatusAndUnregistered() {
  try {
    const [feedRes, unregRes] = await Promise.all([
      fetch(`/brands/${currentBrandId}/feed-status`, { headers: { 'X-Brand-Key': currentBrandKey } }),
      fetch(`/brands/${currentBrandId}/unregistered-uses`, { headers: { 'X-Brand-Key': currentBrandKey } })
    ]);

    if (feedRes.ok) {
      const feedData = await feedRes.json();
      document.getElementById('stat-website-count').textContent = feedData.uses_by_source?.website || 0;
      document.getElementById('stat-seed-count').textContent = feedData.uses_by_source?.synthetic_seed || 0;
      document.getElementById('stat-unreg-count').textContent = feedData.unregistered_uses || 0;
      document.getElementById('stat-last-received').textContent = feedData.last_use_received_at ? formatIST(feedData.last_use_received_at) : 'None yet';

      const banner = document.getElementById('unregistered-banner');
      if (feedData.unregistered_uses > 0) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    if (unregRes.ok) {
      const unregData = await unregRes.json();
      const tbody = document.getElementById('unregistered-tbody');
      const items = unregData.unregistered_uses || [];

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No unregistered code redemptions recorded</td></tr>';
      } else {
        tbody.innerHTML = '';
        for (const it of items) {
          const tr = document.createElement('tr');
          const totalUnits = (it.items || []).reduce((s, x) => s + (x.quantity || 1), 0);
          tr.innerHTML = `
            <td class="font-mono text-accent">${it.order_id}</td>
            <td><span class="badge badge-expired font-mono">${it.code_entered}</span></td>
            <td class="text-right font-mono">${totalUnits}</td>
            <td class="font-mono text-[11px]">${formatIST(it.used_at)}</td>
            <td><span class="source-badge ${it.source === 'website' ? 'source-website' : 'source-seed'}">${it.source}</span></td>
          `;
          tbody.appendChild(tr);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load feed status/unregistered:', err);
  }
}

// 4. Append Event to Live Feed UI
function appendLiveEvent(type, title, details, timestampIso, isWarning = false) {
  const container = document.getElementById('live-events-container');
  const empty = container.querySelector('.empty-feed');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = `feed-item ${isWarning ? 'event-unregistered' : ''} ${type.includes('promo') ? 'event-promo' : ''}`;
  item.innerHTML = `
    <div class="feed-item-header">
      <span class="feed-item-title">${title}</span>
      <span class="feed-item-time">${formatIST(timestampIso || new Date().toISOString())}</span>
    </div>
    <div class="feed-item-body">
      <span>${details}</span>
    </div>
  `;
  container.prepend(item);

  // Keep max 50 items
  while (container.children.length > 50) {
    container.removeChild(container.lastChild);
  }
}

// 5. Connect SSE via fetch + stream reader (sending X-Brand-Key)
async function connectStream() {
  if (streamAbortController) {
    streamAbortController.abort();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  streamAbortController = new AbortController();
  setConnectionStatus('connecting', 'Connecting Stream...');

  try {
    const res = await fetch(`/brands/${currentBrandId}/events`, {
      headers: {
        'X-Brand-Key': currentBrandKey
      },
      signal: streamAbortController.signal
    });

    if (res.status === 429) {
      setConnectionStatus('disconnected', 'Stream Cap (429) - Retrying...');
      scheduleReconnect(5000);
      return;
    }

    if (!res.ok) {
      throw new Error(`Stream connection failed with HTTP ${res.status}`);
    }

    setConnectionStatus('connected', 'Live Stream Connected');

    // Refetch data after successful reconnect
    loadPromoCodes();
    loadFeedStatusAndUnregistered();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || ''; // Keep partial block in buffer

      for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.split('\n');
        let eventName = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith(':')) {
            // Heartbeat comment, e.g. ': ping' or ': connected'
            continue;
          }
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.slice(5).trim();
          }
        }

        if (dataStr) {
          handleIncomingEvent(eventName, dataStr);
        }
      }
    }

    // Stream ended normally
    setConnectionStatus('disconnected', 'Stream Ended - Reconnecting...');
    scheduleReconnect(3000);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('Stream reader error:', err.message);
    setConnectionStatus('disconnected', 'Disconnected - Reconnecting...');
    scheduleReconnect(3000);
  }
}

function scheduleReconnect(delayMs) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectStream();
  }, delayMs);
}

// 6. Handle Incoming SSE Event
function handleIncomingEvent(eventName, dataStr) {
  let payload = {};
  try {
    payload = JSON.parse(dataStr);
  } catch {
    payload = { raw: dataStr };
  }

  if (eventName === 'promo_created') {
    appendLiveEvent('promo', `🎉 Code Created: ${payload.code}`, `Influencer: ${payload.creator_id} &bull; Status: ${payload.status}`, payload.created_at);
    loadPromoCodes();
  } else if (eventName === 'code_updated') {
    appendLiveEvent('promo', `📝 Code Updated: ${payload.code}`, `Valid until: ${formatIST(payload.valid_to)}`, new Date().toISOString());
    loadPromoCodes();
  } else if (eventName === 'use_recorded') {
    const discStr = payload.discount_inr !== null ? `Discount: ₹${payload.discount_inr.toFixed(2)}` : 'Discount: None / Unknown';
    appendLiveEvent('use', `🛍️ Order Paid: ${payload.order_id}`, `Code: <strong>${payload.code_entered}</strong> &bull; Units: ${payload.units} &bull; ${discStr}`, payload.payment_confirmed_at || payload.used_at);
    loadPromoCodes();
    loadFeedStatusAndUnregistered();
  } else if (eventName === 'unregistered_use_recorded') {
    appendLiveEvent('unreg', `⚠️ Unregistered Code: ${payload.code_entered}`, `Order: ${payload.order_id} &bull; Units: ${payload.units}`, payload.payment_confirmed_at || payload.used_at, true);
    loadFeedStatusAndUnregistered();
  }
}

// 7. Promo Registration Form Handling
document.getElementById('promo-registration-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('form-error-msg');
  const successEl = document.getElementById('form-success-msg');
  const submitBtn = document.getElementById('btn-submit-promo');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  submitBtn.disabled = true;

  try {
    const code = document.getElementById('input-code').value.trim().toUpperCase();
    const creatorId = document.getElementById('select-creator').value;
    const validFromLocal = document.getElementById('input-valid-from').value;
    const validToLocal = document.getElementById('input-valid-to').value;

    if (!validFromLocal || !validToLocal) {
      throw new Error('Please select both Valid From and Valid To dates.');
    }

    // Convert local inputs to ISO strings with explicit +05:30 IST timezone
    const validFromIso = new Date(validFromLocal + ':00+05:30').toISOString();
    const validToIso = new Date(validToLocal + ':00+05:30').toISOString();

    const res = await fetch(`/brands/${currentBrandId}/promo-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': currentBrandKey
      },
      body: JSON.stringify({
        code,
        creator_id: creatorId,
        valid_from: validFromIso,
        valid_to: validToIso
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    successEl.textContent = `Promo code "${data.code}" successfully registered for creator ${data.creator_id}!`;
    successEl.classList.remove('hidden');

    form.reset();
    setDefaultDates();
    loadPromoCodes();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

// 8. Patch Dates Modal
let editingCode = null;
function openPatchModal(code, validFromIso, validToIso) {
  editingCode = code;
  document.getElementById('modal-code-name').textContent = code;
  document.getElementById('patch-valid-from').value = toDatetimeLocalIST(new Date(validFromIso));
  document.getElementById('patch-valid-to').value = toDatetimeLocalIST(new Date(validToIso));
  document.getElementById('modal-error-msg').classList.add('hidden');
  document.getElementById('patch-modal').classList.remove('hidden');
}

function closePatchModal() {
  document.getElementById('patch-modal').classList.add('hidden');
  editingCode = null;
}

document.getElementById('modal-close-btn').addEventListener('click', closePatchModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closePatchModal);

document.getElementById('patch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingCode) return;

  const errorEl = document.getElementById('modal-error-msg');
  errorEl.classList.add('hidden');

  try {
    const fromLocal = document.getElementById('patch-valid-from').value;
    const toLocal = document.getElementById('patch-valid-to').value;

    const validFromIso = new Date(fromLocal + ':00+05:30').toISOString();
    const validToIso = new Date(toLocal + ':00+05:30').toISOString();

    const res = await fetch(`/brands/${currentBrandId}/promo-codes/${editingCode}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Brand-Key': currentBrandKey
      },
      body: JSON.stringify({
        valid_from: validFromIso,
        valid_to: validToIso
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    closePatchModal();
    loadPromoCodes();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

// 9. Purge Seed Data
document.getElementById('btn-purge-seed').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to purge all synthetic seed data for this brand?')) return;
  try {
    const res = await fetch(`/brands/${currentBrandId}/purge-seed`, {
      method: 'POST',
      headers: { 'X-Brand-Key': currentBrandKey }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    alert('Synthetic seed data successfully purged.');
    loadPromoCodes();
    loadFeedStatusAndUnregistered();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
});

// Refresh buttons
document.getElementById('btn-refresh-promos').addEventListener('click', loadPromoCodes);
document.getElementById('btn-refresh-unreg').addEventListener('click', loadFeedStatusAndUnregistered);
document.getElementById('dismiss-banner-btn').addEventListener('click', () => {
  document.getElementById('unregistered-banner').classList.add('hidden');
});

// Brand Switcher
document.getElementById('brand-select').addEventListener('change', (e) => {
  currentBrandId = e.target.value;
  currentBrandKey = BRAND_KEYS[currentBrandId];
  document.getElementById('live-events-container').innerHTML = `
    <div class="empty-feed text-center text-muted">
      <div class="radar-scan"></div>
      <p>Listening for real-time checkout & registration events (${currentBrandId})...</p>
    </div>
  `;
  initDashboard();
});

function setDefaultDates() {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  document.getElementById('input-valid-from').value = toDatetimeLocalIST(now);
  document.getElementById('input-valid-to').value = toDatetimeLocalIST(nextMonth);
}

function initDashboard() {
  setDefaultDates();
  loadCreators();
  loadPromoCodes();
  loadFeedStatusAndUnregistered();
  connectStream();

  // 60-second periodic refresh fallback
  if (periodicRefreshTimer) clearInterval(periodicRefreshTimer);
  periodicRefreshTimer = setInterval(() => {
    loadPromoCodes();
    loadFeedStatusAndUnregistered();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', initDashboard);
