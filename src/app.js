import { Storage } from './storage.js';
import { seedIfEmpty, DEFAULT_USERS } from './seed.js';
import { el, formatDateTime } from './ui.js';
import { createCloud } from './cloud.js';

const APP_VERSION = '1.0.0';

const USER_EMAILS = {
  michel: 'michel@couple-plans.local',
  sarahi: 'sarahi@couple-plans.local',
};

const ALLOWED_EMAILS = Object.values(USER_EMAILS);

const cloud = createCloud(ALLOWED_EMAILS);

const THEME_KEY = 'cp.theme';

function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light';
  } catch {
    return 'light';
  }
}

function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // ignore
  }
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  render();
}

const state = {
  session: null, // { username, email }
  user: null, // Firebase user
  cloudReady: false,
  plans: [],
  // logs feature removed — keep only role in session
  locations: [],
  editingId: null,
  homeTab: 'plans', // 'new' | 'plans'
  viewMode: 'list', // 'list' | 'compact'
  sort: 'none', // 'none' | 'az' | 'za'
  filters: {
    q: '',
    status: 'Pendiente',
    type: 'all',
    time: 'all',
    tagTypes: [],
    tagTimes: [],
    tagOwners: [],
  },
};

function getPlanEmojis(p) {
  const typeEmoji = p.type === 'Comida' ? '🐷' : '🚗';
  const timeEmoji = p.time === 'Día' ? '🌤️' : p.time === 'Tarde' ? '☀️' : '🌑';
  return { typeEmoji, timeEmoji };
}

// Normalize owner/key for matching (returns a short key like 'sarahi' or 'michel')
function getOwnerKey(p) {
  const raw = p?.createdBy ?? p?.completedBy ?? '';
  if (!raw) return '';
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    const at = s.indexOf('@');
    if (at > 0) return s.slice(0, at);
    if (s.includes(' ')) return s.split(/\s+/)[0];
    return s;
  }
  if (typeof raw === 'object') {
    const maybe = String(raw.email || raw.displayName || raw.username || '').trim().toLowerCase();
    const at = maybe.indexOf('@');
    if (at > 0) return maybe.slice(0, at);
    if (maybe.includes(' ')) return maybe.split(/\s+/)[0];
    return maybe;
  }
  return '';
}

function toggleInArray(arr, value) {
  const v = String(value);
  const list = Array.isArray(arr) ? arr.slice() : [];
  const idx = list.indexOf(v);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(v);
  return list;
}

function chooseOne(arr, value) {
  const v = String(value);
  const list = Array.isArray(arr) ? arr : [];
  if (list.length === 1 && list[0] === v) return [];
  return [v];
}

function syncTimeDropdownFromTags() {
  if (!Array.isArray(state.filters.tagTimes) || state.filters.tagTimes.length !== 1) {
    state.filters.time = 'all';
    return;
  }
  state.filters.time = state.filters.tagTimes[0];
}

function load() {
  seedIfEmpty();
  // Keep local data for migration fallback
  state.session = null;
  // Load existing plans from local storage and migrate only those missing createdBy
  try {
    const stored = Storage.getPlans();
    state.plans = Array.isArray(stored) ? stored.map((p) => {
      const hasCreated = p && p.createdBy && String(p.createdBy).trim();
      const createdBy = hasCreated ? p.createdBy : 'michel@couple-plans.local';
      // ownerKey: if present keep, otherwise derive from createdBy
      const ownerKey = hasCreated ? (p.ownerKey || getOwnerKey({ createdBy })) : 'michel';
      return { ...p, createdBy, ownerKey };
    }) : [];
    // Persist only if we modified any entry (safe to resave to ensure consistency)
    savePlans();
  } catch (err) {
    state.plans = [];
  }
  state.locations = [];
}

function savePlans() {
  Storage.setPlans(state.plans);
}

function saveLocations() {
  Storage.setLocations(state.locations);
}

function addLocationIfNew(value) {
  const v = String(value || '').trim();
  if (!v) return;
  const exists = state.locations.some((x) => String(x).toLowerCase() === v.toLowerCase());
  if (exists) return;
  state.locations.unshift(v);
  // keep list compact
  state.locations = state.locations.slice(0, 80);
  saveLocations();
}

function toast(message) {
  const node = document.querySelector('[data-toast]');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => node.classList.remove('show'), 1800);
}

// logs feature removed — cache-reset helper and related UI removed

function confirmModal({ title = 'Confirmar', message = '¿Estás seguro?', confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    const root = document.querySelector('[data-modal-root]') || document.body;

    const overlay = el('div', { className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true' },
      el('div', { className: 'modal' },
        el('div', { className: 'modal-title', textContent: title }),
        el('div', { className: 'modal-text', textContent: message }),
        el('div', { className: 'row end' },
          el('button', {
            className: 'btn',
            type: 'button',
            textContent: cancelText,
            onclick: () => {
              overlay.remove();
              resolve(false);
            },
          }),
          el('button', {
            className: 'btn danger',
            type: 'button',
            textContent: confirmText,
            onclick: () => {
              overlay.remove();
              resolve(true);
            },
          }),
        ),
      ),
    );

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });

    window.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') {
        window.removeEventListener('keydown', onKey);
        if (overlay.isConnected) overlay.remove();
        resolve(false);
      }
    });

    root.appendChild(overlay);
  });
}

function setRoute(view) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', view);
  history.replaceState({}, '', url);
}

function getRoute() {
  const url = new URL(window.location.href);
  return url.searchParams.get('view') || 'home';
}

function requireAuth() {
  if (!state.session) {
    setRoute('login');
    render();
    return false;
  }
  return true;
}

function sanitizePlanInput(input) {
  const plan = {
    id: input.id ?? crypto.randomUUID(),
    place: String(input.place || '').trim(),
    type: input.type === 'Comida' ? 'Comida' : 'Visitar',
    time: ['Día', 'Tarde', 'Noche'].includes(input.time) ? input.time : 'Noche',
    status: input.status === 'Completado' ? 'Completado' : 'Pendiente',
    location: String(input.location || '').trim(),
    googleMapLink: String(input.googleMapLink || '').trim(),
  // Ensure createdBy is always populated from the session when missing/undefined
  // Prefer session.email so stored createdBy is the user's email address.
  createdBy: (typeof input.createdBy === 'string' && input.createdBy.trim())
    ? input.createdBy.trim()
    : (state.session?.email || state.session?.username || null),
    rating: Number(input.rating || 0), // 0..5
    goAgain: input.goAgain === 'Sí' ? 'Sí' : 'No',
    isFavorite: Boolean(input.isFavorite),
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: input.completedAt ?? null,
    completedBy: input.completedBy ?? null,
  };

  if (!plan.place) throw new Error('Escribe un lugar.');
  if (!plan.location) throw new Error('Escribe una ubicación.');
  if (!Number.isFinite(plan.rating) || plan.rating < 0 || plan.rating > 5) {
    throw new Error('La calificación debe ser entre 0 y 5.');
  }

  if (plan.status === 'Pendiente') {
    plan.rating = 0;
    plan.goAgain = 'No';
    plan.completedAt = null;
    plan.completedBy = null;
  } else {
    plan.completedAt = plan.completedAt ?? new Date().toISOString();
    plan.completedBy = plan.completedBy ?? state.session?.username ?? null;
  }

  return plan;
}

function upsertPlan(plan) {
  const idx = state.plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) state.plans[idx] = plan;
  else state.plans.unshift(plan);
  savePlans();
}

function deletePlan(id) {
  state.plans = state.plans.filter((p) => p.id !== id);
  savePlans();
}

async function upsertPlanCloud(plan) {
  // Always keep local mirror (for offline-ish UX), then write to cloud
  // Defensive: ensure createdBy is populated before local/cloud persist
  if (!plan.createdBy) plan.createdBy = state.session?.email || state.session?.username || null;
  upsertPlan(plan);
  if (!state.cloudReady) return;
  await cloud.upsertPlan(plan);
}

async function deletePlanCloud(id) {
  deletePlan(id);
  if (!state.cloudReady) return;
  await cloud.deletePlan(id);
}

async function persistOrderForIds(orderedIds) {
  // Assign 1..N order; smaller = higher priority
  const idToOrder = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
  const updates = [];

  for (const p of state.plans) {
    if (!idToOrder.has(p.id)) continue; // only update visible subset
    const nextOrder = idToOrder.get(p.id);
    const curOrder = Number.isFinite(Number(p.order)) ? Number(p.order) : 0;
    if (curOrder === nextOrder) continue;
    updates.push({ ...p, order: nextOrder });
  }

  if (!updates.length) return;

  // optimistic local update
  for (const u of updates) upsertPlan(u);
  render();

  // persist sequentially (small N)
  for (const u of updates) {
    await upsertPlanCloud(u);
  }
}

function setupDragAndDrop(listRoot, plans) {
  // Minimal DnD using pointer events (works on mobile too).
  const draggables = Array.from(listRoot.querySelectorAll('[data-plan-id]'));
  const byId = new Map(plans.map((p) => [p.id, p]));

  let draggingId = null;
  let pointerStartY = 0;
  let lastOrderIds = plans.map((p) => p.id);
  let raf = 0;

  const clearDragging = () => {
    draggables.forEach((n) => n.classList.remove('dragging', 'drag-over'));
    draggingId = null;
    pointerStartY = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    listRoot.classList.remove('drag-mode');
  };

  const getCardFromPoint = (clientX, clientY) => {
    // On mobile, ev.target often stays as the handle while moving.
    // elementFromPoint gives the element currently under the finger.
    const elAt = document.elementFromPoint(clientX, clientY);
    if (!(elAt instanceof Element)) return null;
    return elAt.closest('[data-plan-id]');
  };

  const scrollBy = (dy) => {
    if (!dy) return;
    const el = document.scrollingElement || document.documentElement;
    const max = (el.scrollHeight - el.clientHeight);
    if (max <= 0) return;
    const next = Math.max(0, Math.min(max, el.scrollTop + dy));
    if (next === el.scrollTop) return;
    el.scrollTop = next;
  };

  const edgeAutoScroll = (clientY) => {
    // During dragging we disable native scroll via preventDefault(),
    // so we add a small programmatic auto-scroll near viewport edges.
    const margin = 70; // px
    const maxSpeed = 18; // px per move
    const vh = window.innerHeight || 0;
    if (!vh) return;

    let dy = 0;
    if (clientY < margin) {
      const t = (margin - clientY) / margin; // 0..1
      dy = -Math.round(maxSpeed * t);
    } else if (clientY > vh - margin) {
      const t = (clientY - (vh - margin)) / margin; // 0..1
      dy = Math.round(maxSpeed * t);
    }
    scrollBy(dy);
  };

  const onPointerMove = (ev) => {
    if (!draggingId) return;
    // prevent scroll while dragging
    ev.preventDefault();
    edgeAutoScroll(ev.clientY);
    const over = getCardFromPoint(ev.clientX, ev.clientY);
    draggables.forEach((n) => n.classList.toggle('drag-over', n === over));
  };

  const onPointerUp = async (ev) => {
    if (!draggingId) return;
    const over = getCardFromPoint(ev.clientX, ev.clientY);
    const fromId = draggingId;
    const toId = over?.getAttribute('data-plan-id');
  // cleanup listeners
    listRoot.removeEventListener('pointermove', onPointerMove);
    listRoot.removeEventListener('pointercancel', onPointerUp);
  clearDragging();

    if (!toId || toId === fromId) return;

    const ids = plans.map((p) => p.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, fromId);
    lastOrderIds = ids;
    toast('Prioridad actualizada.');
    await persistOrderForIds(ids);
  };

  draggables.forEach((node) => {
    const id = node.getAttribute('data-plan-id');
    if (!id || !byId.has(id)) return;

    const handle = node.querySelector('[data-drag-handle]');
    if (!handle) return;

    handle.addEventListener('pointerdown', (ev) => {
      // Only starts if user grabs the handle
      // Prevent details toggle + prevent scroll stealing the gesture on mobile.
      ev.preventDefault();
      ev.stopPropagation();
      draggingId = id;
      pointerStartY = ev.clientY;
      node.classList.add('dragging');
      listRoot.classList.add('drag-mode');
      try { handle.setPointerCapture(ev.pointerId); } catch {
        // ignore
      }
      // Capture on listRoot so we keep receiving events even if finger leaves the handle.
      try { listRoot.setPointerCapture(ev.pointerId); } catch {
        // ignore
      }
      listRoot.addEventListener('pointermove', onPointerMove, { passive: false });
      listRoot.addEventListener('pointerup', onPointerUp, { once: true });
      listRoot.addEventListener('pointercancel', onPointerUp, { once: true });
    });
  });
}

function applyFilters(plans) {
  const q = state.filters.q.trim().toLowerCase();
  const filtered = plans.filter((p) => {
    if (q) {
      const hay = `${p.place} ${p.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.filters.status !== 'all' && p.status !== state.filters.status) return false;
    if (state.filters.type !== 'all' && p.type !== state.filters.type) return false;
    if (state.filters.time !== 'all' && p.time !== state.filters.time) return false;

    // Tag filters (multi-select). If any selected, the plan must match one of them.
    if (Array.isArray(state.filters.tagTypes) && state.filters.tagTypes.length) {
      if (!state.filters.tagTypes.includes(p.type)) return false;
    }
    if (Array.isArray(state.filters.tagTimes) && state.filters.tagTimes.length) {
      if (!state.filters.tagTimes.includes(p.time)) return false;
    }
    // Owner filters: if any selected, the plan must match one of the selected owner keys
    if (Array.isArray(state.filters.tagOwners) && state.filters.tagOwners.length) {
      const ownerKey = getOwnerKey(p); // normalized short key (eg. 'sarahi')
      const matches = state.filters.tagOwners.some((k) => {
        const sel = String(k || '').toLowerCase();
        if (!ownerKey) return false;
        // accept exact match or containment (defensive)
        return ownerKey === sel || ownerKey.includes(sel) || sel.includes(ownerKey);
      });
      if (!matches) return false;
    }
    return true;
  });

  // Order: if user requested alphabetical sort, apply it; otherwise use favorites/order/updatedAt
  const ts = (v) => {
    if (!v) return 0;
    if (typeof v === 'string') return Date.parse(v) || 0;
    // Firestore Timestamp { seconds, nanoseconds }
    if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
  };

  const coll = filtered.slice();

  if (state.sort === 'az' || state.sort === 'za') {
    const dir = state.sort === 'az' ? 1 : -1;
    coll.sort((a, b) => {
      const pa = String(a.place || '').trim().toLowerCase();
      const pb = String(b.place || '').trim().toLowerCase();
      if (pa < pb) return -1 * dir;
      if (pa > pb) return 1 * dir;
      // tie-breaker: favorites, then manual order, then updatedAt
      const favA = a.isFavorite ? 1 : 0;
      const favB = b.isFavorite ? 1 : 0;
      if (favA !== favB) return favB - favA;
      const oa = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
      const ob = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
      if (oa !== ob) return oa - ob;
      return ts(b.updatedAt) - ts(a.updatedAt);
    });
    return coll;
  }

  return coll.sort((a, b) => {
    const favA = a.isFavorite ? 1 : 0;
    const favB = b.isFavorite ? 1 : 0;
    if (favA !== favB) return favB - favA;

    const oa = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
    const ob = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
    if (oa !== ob) return oa - ob;

    return ts(b.updatedAt) - ts(a.updatedAt);
  });
}

function renderTopbar() {
  return el('header', { className: 'topbar' },
    el('div', { className: 'topbar-inner' },
      el('div', { className: 'brand' },
  el('div', { className: 'brand-logo', innerHTML: '<img alt="" src="./assets/couple-plans-png.png" width="22" height="22" />' }),
        el('div', { className: 'brand-title' },
          el('strong', { textContent: 'Couple Plans' }),
          el('span', {
            textContent: state.session
              ? `Sesión: ${state.session.email || state.session.username}${state.session.role ? ' · ' + state.session.role : ''}`
              : 'Lista de planes',
          }),
        ),
      ),
      el('div', { className: 'row nowrap' },
        state.session
          ? el('button', {
              className: 'btn ghost small',
              type: 'button',
              textContent: 'Cerrar sesión',
              onclick: () => {
                cloud.signOut();
                state.session = null;
                state.user = null;
                state.editingId = null;
                setRoute('login');
                render();
              },
            })
          : null,
      ),
    ),
  );
}

function renderLogin() {
  const userId = 'login-user';
  const passId = 'login-pass';
  const showId = 'login-show';

  const node = el('main', { className: 'container' },
    el('div', { className: 'card' },
      el('div', { className: 'card-inner grid' },
        el('div', { style: 'text-align:center' },
          el('h2', { textContent: 'Iniciar sesión' }),
        ),
        el('form', {
          className: 'grid',
          onsubmit: async (e) => {
            e.preventDefault();
            const username = document.getElementById(userId).value.trim().toLowerCase();
            const password = document.getElementById(passId).value;
            const email = USER_EMAILS[username];
            if (!email) return toast('Usuario inválido. Usa: michel o sarahi.');
            try {
              await cloud.signIn(email, password);
            } catch (err) {
              toast(err?.message || 'No se pudo iniciar sesión.');
            }
          },
        },
          el('div', {},
            el('label', { htmlFor: userId, textContent: 'Usuario' }),
            el('input', { id: userId, className: 'input', autocomplete: 'username', required: true, placeholder: 'Usuario', value: '' }),
          ),
          el('div', {},
            el('label', { htmlFor: passId, textContent: 'Contraseña' }),
            el('div', { className: 'row', style: 'flex-wrap:nowrap' },
              el('input', { id: passId, className: 'input', type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••', value: '' }),
              el('button', {
                id: showId,
                className: 'btn small',
                type: 'button',
                textContent: '👁',
                'aria-label': 'Mostrar contraseña',
                onclick: () => {
                  const input = document.getElementById(passId);
                  const btn = document.getElementById(showId);
                  if (!input || !btn) return;
                  const showing = input.type === 'text';
                  input.type = showing ? 'password' : 'text';
                  btn.textContent = showing ? '👁' : '🙈';
                  btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
                },
              }),
            ),
          ),
          el('div', { className: 'row space' },
            el('button', { className: 'btn primary', type: 'submit', textContent: 'Ingresar', style: 'margin-left:auto;margin-right:auto' }),
          ),
        ),
      ),
    ),
  );

  return node;
}

function renderHome() {
  if (!requireAuth()) return el('main', { className: 'container' });

  const filtered = applyFilters(state.plans);

  const tabs = el('div', { className: 'tabs' },
    el('button', {
      className: `tab ${state.homeTab === 'plans' ? 'active' : ''}`,
      type: 'button',
      textContent: 'Planes',
      onclick: () => {
        state.homeTab = 'plans';
        render();
      },
    }),
    el('button', {
      className: `tab ${state.homeTab === 'new' ? 'active' : ''}`,
      type: 'button',
      textContent: 'Nuevo plan',
      onclick: () => {
        state.homeTab = 'new';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      },
    }),
  );

  // Alphabetical sort / view toggle: create the control first so it can be
  // referenced when building the statusQuick block below (avoid TDZ).
  const viewToggle = el('div', { className: 'view-toggle', role: 'group', 'aria-label': 'Vista de planes' },
    el('button', {
      className: `view-toggle__btn ${state.viewMode === 'list' ? 'active' : ''}`,
      type: 'button',
      title: 'Vista lista',
      'aria-pressed': state.viewMode === 'list' ? 'true' : 'false',
      textContent: '☰',
      onclick: () => {
        state.viewMode = 'list';
        render();
      },
    }),
    el('button', {
      className: `view-toggle__btn ${state.viewMode === 'compact' ? 'active' : ''}`,
      type: 'button',
      title: 'Vista compacta',
      'aria-pressed': state.viewMode === 'compact' ? 'true' : 'false',
      textContent: '▦',
      onclick: () => {
        state.viewMode = 'compact';
        render();
      },
    }),
    // Alphabetical sort buttons (A→Z, Z→A)
    el('button', {
      className: `view-toggle__btn ${state.sort === 'az' ? 'active' : ''}`,
      type: 'button',
      title: 'Orden A↑',
      'aria-pressed': state.sort === 'az' ? 'true' : 'false',
  innerHTML: '<svg width="28" height="14" viewBox="0 0 28 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="1" y="10" font-size="10" font-family="sans-serif" fill="currentColor">A</text><path d="M18 11 L18 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M15 6 L18 3 L21 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      onclick: () => {
        state.sort = state.sort === 'az' ? 'none' : 'az';
        render();
      },
    }),
    el('button', {
      className: `view-toggle__btn ${state.sort === 'za' ? 'active' : ''}`,
      type: 'button',
      title: 'Orden Z↓',
      'aria-pressed': state.sort === 'za' ? 'true' : 'false',
  innerHTML: '<svg width="28" height="14" viewBox="0 0 28 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><text x="1" y="10" font-size="10" font-family="sans-serif" fill="currentColor">Z</text><path d="M18 3 L18 11" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M15 8 L18 11 L21 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      onclick: () => {
        state.sort = state.sort === 'za' ? 'none' : 'za';
        render();
      },
    }),
  );

  // Top: status pills + view-toggle on same row; Bottom: small counter on its own row
  const statusQuick = el('div', { className: 'grid' },
    el('div', { className: 'row space' },
      el('div', { className: 'row' },
        el('button', {
          className: `pill-btn pending ${state.filters.status === 'Pendiente' ? 'active' : ''}`,
          type: 'button',
          textContent: 'Pendiente',
          onclick: () => {
            state.filters.status = 'Pendiente';
            render();
          },
        }),
        el('button', {
          className: `pill-btn done ${state.filters.status === 'Completado' ? 'active' : ''}`,
          type: 'button',
          textContent: 'Completado',
          onclick: () => {
            state.filters.status = 'Completado';
            render();
          },
        }),
      ),
      // place viewToggle as a direct child of the .row.space so CSS pushes it right
      viewToggle,
    ),
  // small counter on its own line below (right-aligned)
  el('div', { className: 'row right' }, el('div', { className: 'small', textContent: `${filtered.length} ${filtered.length === 1 ? 'plan filtrado' : 'planes filtrados'} de ${state.plans.length}` })),
  );

  return el('main', { className: 'container' },
    el('div', { className: 'card' },
      el('div', { className: 'card-inner grid' },
        el('div', { className: 'row space' },
          el('h2', { textContent: 'Couple Plans' }),
          el('div', { className: 'row' },
            el('button', {
              className: 'theme-toggle',
              type: 'button',
              title: 'Cambiar tema',
              'aria-label': 'Cambiar tema',
              onclick: () => toggleTheme(),
            },
              el('span', { className: 'theme-toggle__emoji', textContent: getTheme() === 'dark' ? '🌙' : '☀️' }),
              el('span', { className: 'theme-toggle__text', textContent: getTheme() === 'dark' ? 'Oscuro' : 'Claro' }),
              el('span', { className: `theme-toggle__switch ${getTheme() === 'dark' ? 'is-on' : ''}` },
                el('span', { className: 'theme-toggle__knob' }),
              ),
            ),
          ),
        ),
        tabs,
        state.homeTab === 'new'
          ? el('div', { className: 'card-inner', style: 'padding:0' }, renderPlanForm())
          : el('div', { className: 'grid' },
              renderFilters(),
              // status pills and view toggle on the same row; small counter below
              el('div', { className: 'row' }, statusQuick),
              renderPlanList(filtered),
            ),
      ),
    ),
  );
}

function renderFilters() {
  const qId = 'filter-q';

  const onChange = (e) => {
    // Preserve caret/focus across the main re-render so mobile keyboards don't hide.
    const inputEl = e?.target || document.getElementById(qId);
    const pos = (inputEl && typeof inputEl.selectionStart === 'number') ? inputEl.selectionStart : null;
    state.filters.q = inputEl ? inputEl.value : document.getElementById(qId).value;
    render();
    // Restore focus & caret position on the recreated input (best-effort).
    const newEl = document.getElementById(qId);
    if (newEl) {
      try {
        newEl.focus();
        if (pos !== null) newEl.setSelectionRange(pos, pos);
      } catch (err) {
        // ignore - some mobile browsers may disallow programmatic focus/selection
      }
    }
  };

  const tags = el('div', { className: 'tagbar', role: 'group', 'aria-label': 'Filtros por tipo y horario' },
    el('button', {
      className: `tag ${state.filters.tagTypes.includes('Comida') ? 'active' : ''}`,
      type: 'button',
      textContent: '🐷',
      title: 'Tipo: Comida',
      'aria-pressed': state.filters.tagTypes.includes('Comida') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagTypes = chooseOne(state.filters.tagTypes, 'Comida');
        state.filters.type = state.filters.tagTypes[0] || 'all';
        render();
      },
    }),
    el('button', {
      className: `tag ${state.filters.tagTypes.includes('Visitar') ? 'active' : ''}`,
      type: 'button',
      textContent: '🚗',
      title: 'Tipo: Visitar',
      'aria-pressed': state.filters.tagTypes.includes('Visitar') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagTypes = chooseOne(state.filters.tagTypes, 'Visitar');
        state.filters.type = state.filters.tagTypes[0] || 'all';
        render();
      },
    }),
    el('span', { className: 'tag-sep', textContent: '·' }),
    el('button', {
      className: `tag ${state.filters.tagTimes.includes('Día') ? 'active' : ''}`,
      type: 'button',
      textContent: '🌤️',
      title: 'Horario: Día',
      'aria-pressed': state.filters.tagTimes.includes('Día') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagTimes = toggleInArray(state.filters.tagTimes, 'Día');
        syncTimeDropdownFromTags();
        render();
      },
    }),
    el('button', {
      className: `tag ${state.filters.tagTimes.includes('Tarde') ? 'active' : ''}`,
      type: 'button',
      textContent: '☀️',
      title: 'Horario: Tarde',
      'aria-pressed': state.filters.tagTimes.includes('Tarde') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagTimes = toggleInArray(state.filters.tagTimes, 'Tarde');
        syncTimeDropdownFromTags();
        render();
      },
    }),
    el('button', {
      className: `tag ${state.filters.tagTimes.includes('Noche') ? 'active' : ''}`,
      type: 'button',
      textContent: '🌑',
      title: 'Horario: Noche',
      'aria-pressed': state.filters.tagTimes.includes('Noche') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagTimes = toggleInArray(state.filters.tagTimes, 'Noche');
        syncTimeDropdownFromTags();
        render();
      },
    }),
    // separator between time tags and owner tags
    el('span', { className: 'tag-sep', textContent: '·' }),
    // Owner tags: sarahi first, then michel (multi-select)
    el('button', {
      className: `tag ${state.filters.tagOwners.includes('sarahi') ? 'active' : ''}`,
      type: 'button',
      textContent: '👧🏼',
      title: 'Registrado por: Sarahi',
      'aria-pressed': state.filters.tagOwners.includes('sarahi') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagOwners = toggleInArray(state.filters.tagOwners, 'sarahi');
        render();
      },
    }),
    el('button', {
      className: `tag ${state.filters.tagOwners.includes('michel') ? 'active' : ''}`,
      type: 'button',
      textContent: '👦🏻',
      title: 'Registrado por: Michel',
      'aria-pressed': state.filters.tagOwners.includes('michel') ? 'true' : 'false',
      onclick: () => {
        state.filters.tagOwners = toggleInArray(state.filters.tagOwners, 'michel');
        render();
      },
    }),
    (state.filters.tagTypes.length || state.filters.tagTimes.length || state.filters.tagOwners.length) ? el('button', {
      className: 'tag clear',
      type: 'button',
      textContent: '✕',
      title: 'Limpiar tags',
      onclick: () => {
        state.filters.tagTypes = [];
        state.filters.tagTimes = [];
        state.filters.tagOwners = [];

        // Keep dropdowns consistent with cleared tags
        state.filters.type = 'all';
        state.filters.time = 'all';
        render();
      },
    }) : null,
  );

  return el('div', { className: 'grid' },
    el('div', { className: 'form-grid two' },
    el('div', {},
      el('label', { htmlFor: qId, textContent: 'Buscar' }),
  el('input', { id: qId, className: 'input', value: state.filters.q, oninput: onChange }),
    ),
    ),
    el('div', {},
      el('div', { className: 'small', style: 'margin-top:2px' , textContent: 'Tags:' }),
      tags,
    ),
  );
}

function renderPlanForm() {
  const isEditing = Boolean(state.editingId);
  const plan = isEditing ? state.plans.find((p) => p.id === state.editingId) : null;

  const ids = {
    place: 'plan-place',
    location: 'plan-location',
    type: 'plan-type',
    time: 'plan-time',
    status: 'plan-status',
    goAgain: 'plan-goagain',
  };

  const locationListId = 'locations-list';
  const mapFrameId = 'location-map-frame';
  const mapLinkId = 'plan-google-map';

  const updateMapPreview = () => {
    // Preview an optional Google Maps link entered by the user.
    const linkInput = document.getElementById(mapLinkId);
    const frame = document.getElementById(mapFrameId);
    if (!frame) return;
    const raw = linkInput ? linkInput.value.trim() : '';
    if (!raw) {
      frame.src = 'about:blank';
      return;
    }

    // Prefer an embeddable Google Maps URL when the user provided a Google maps share/short link.
    // Many short links (maps.app.goo.gl, goo.gl/maps) redirect and are not directly embeddable,
    // so we convert them into a search/embed URL that works in an <iframe> most of the time.
    let src = raw;
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      if (host.includes('maps.app.goo.gl') || host.includes('goo.gl') || host.includes('google') && u.pathname.includes('/maps')) {
        // Build a generic embed/search URL that works for addresses and short links.
        src = 'https://www.google.com/maps?q=' + encodeURIComponent(raw) + '&output=embed';
      }
    } catch (e) {
      // If it's not a valid absolute URL, still try to search it on google maps.
      src = 'https://www.google.com/maps?q=' + encodeURIComponent(raw) + '&output=embed';
    }

    frame.src = src;

    // Hide fallback by default; we'll show it if the iframe is blocked or errors.
    const fallback = document.getElementById('map-fallback');
    if (fallback) fallback.style.display = 'none';

    // If there's no meaningful src, keep fallback hidden.
    if (!src || src === 'about:blank') {
      if (fallback) fallback.style.display = 'none';
      return;
    }

    // Try to detect cross-origin / X-Frame-Options blocking.
    // onload may still fire even when embedding is blocked, so we attempt a safe access
    // to the iframe document; if it throws, we assume it's blocked and show the fallback.
    try {
      frame.onload = () => {
        try {
          // Accessing contentDocument for cross-origin frames will throw in most browsers.
          const doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          // If accessible and seems to have a body, assume embed worked.
          if (doc && doc.body) {
            if (fallback) fallback.style.display = 'none';
            return;
          }
        } catch (err) {
          if (fallback) fallback.style.display = '';
          return;
        }
      };
    } catch (err) {
      // Defensive: if something goes wrong assigning handlers, show fallback.
      if (fallback) fallback.style.display = '';
    }

    frame.onerror = () => {
      if (fallback) fallback.style.display = '';
    };
  };

  const ratingRootId = 'plan-rating';

  const setStatusUI = () => {
    const status = document.getElementById(ids.status)?.value;
    const goAgainWrap = document.querySelector('[data-go-again]');
    const ratingWrap = document.querySelector('[data-rating]');
    if (!goAgainWrap || !ratingWrap) return;
    const completed = status === 'Completado';
    goAgainWrap.style.display = completed ? '' : 'none';
    ratingWrap.style.display = completed ? '' : 'none';

    if (!completed) {
      // reset UI stars
      document.querySelectorAll(`#${ratingRootId} [data-star]`).forEach((b) => b.setAttribute('aria-pressed', 'false'));
    }
  };

  const currentRating = plan?.rating ?? 0;

  const form = el('form', {
    className: 'grid',
    onsubmit: async (e) => {
      e.preventDefault();
      // Prevent duplicate plan names (case-insensitive) when creating a new plan
      const placeEl = document.getElementById(ids.place);
      const placeVal = String(placeEl?.value || '').trim();
      if (!placeVal) {
        toast('Escribe un lugar.');
        return;
      }
      const duplicate = state.plans.some((p) => String(p.place || '').trim().toLowerCase() === placeVal.toLowerCase() && p.id !== plan?.id);
      if (duplicate) {
        toast('Ya existe un plan con ese nombre.');
        return;
      }
      const status = document.getElementById(ids.status).value;
      const rating = Number(document.querySelector(`#${ratingRootId} input[name="rating"]`)?.value || 0);
      const payload = {
        id: plan?.id,
        createdAt: plan?.createdAt,
        createdBy: plan?.createdBy,
        completedAt: plan?.completedAt,
        completedBy: plan?.completedBy,
        place: document.getElementById(ids.place).value,
        location: document.getElementById(ids.location).value,
        type: document.getElementById(ids.type).value,
        time: document.getElementById(ids.time).value,
        status,
        rating: status === 'Completado' ? rating : 0,
        goAgain: status === 'Completado' ? document.getElementById(ids.goAgain).value : 'No',
        // Preserve favorite status when editing (if not provided by the form)
        isFavorite: typeof plan?.isFavorite === 'boolean' ? plan.isFavorite : false,
        googleMapLink: (document.getElementById(mapLinkId)?.value || '').trim(),
      };

      try {
        const normalized = sanitizePlanInput(payload);
        addLocationIfNew(normalized.location);
  // also push new locations to cloud (shared)
  if (state.cloudReady) await cloud.setLocations(state.locations);
        await upsertPlanCloud(normalized);
        state.editingId = null;
        toast(isEditing ? 'Plan actualizado.' : 'Plan agregado.');
        render();
      } catch (err) {
        toast(err?.message || 'Revisa el formulario.');
      }
    },
  },
    el('div', { className: 'row space' },
      el('div', {},
        el('h2', { textContent: isEditing ? 'Editar plan' : 'Nuevo plan' }),
        el('div', { className: 'small', textContent: 'Guárdalo como “Pendiente” y cuando lo hagan lo marcas “Completado”.' }),
      ),
      isEditing
        ? el('button', {
            className: 'btn small',
            type: 'button',
            textContent: 'Cancelar',
            onclick: () => {
              state.editingId = null;
              render();
            },
          })
        : null,
    ),

    el('div', {},
      el('label', { htmlFor: ids.place, textContent: 'Lugar' }),
      el('input', { id: ids.place, className: 'input', required: true, placeholder: 'Ej. Mirador Obispado', value: plan?.place ?? '' }),
    ),

    el('div', {},
      el('label', { htmlFor: ids.location, textContent: 'Ubicación' }),
      el('input', {
        id: ids.location,
        className: 'input',
        required: true,
        list: locationListId,
        placeholder: 'Ej. Monterrey, Nuevo León, México',
        value: plan?.location ?? '',
        oninput: () => updateMapPreview(),
      }),
      el('datalist', { id: locationListId },
        ...state.locations.map((loc) => el('option', { value: loc })),
      ),
      el('div', { className: 'help', textContent: 'Tip: escribe y selecciona una sugerencia. Si no existe, se guarda y aparecerá después.' }),
      // Optional Google Maps link input (if provided, we show it embedded below)
      el('div', { className: 'row' },
        el('label', { htmlFor: mapLinkId, textContent: 'Link de Google Maps (opcional)' }),
        el('input', {
          id: mapLinkId,
          className: 'input',
          placeholder: 'Ej. https://maps.app.goo.gl/dTPgNoWRp5Zi9dSTA',
          value: plan?.googleMapLink ?? '',
          oninput: () => updateMapPreview(),
        }),
      ),
      el('div', { style: 'margin-top:8px' },
        el('iframe', {
          id: mapFrameId,
          title: 'Mapa (Google Maps)',
          src: plan?.googleMapLink || 'about:blank',
          style: 'width:100%;height:220px;border:1px solid rgba(255,255,255,0.14);border-radius:14px;background:rgba(255,255,255,0.04);',
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
        }),
        // Fallback UI: shown when the iframe cannot display the map (X-Frame-Options, etc.)
        el('div', { id: 'map-fallback', style: `display:${plan?.googleMapLink ? 'none' : 'none'}; margin-top:8px` },
          el('div', { className: 'row' },
            el('button', {
              id: 'map-open-btn',
              className: 'btn',
              type: 'button',
              textContent: 'Abrir en Google Maps',
              onclick: () => {
                const raw = document.getElementById(mapLinkId)?.value || '';
                let openUrl = raw || '';
                try {
                  // If raw is not an absolute URL, fallback to a search URL
                  new URL(raw);
                } catch (e) {
                  openUrl = 'https://www.google.com/maps?q=' + encodeURIComponent(raw || '');
                }
                if (openUrl) window.open(openUrl, '_blank', 'noopener');
              },
            }),
            el('div', { className: 'small', style: 'margin-left:8px', textContent: 'Si el mapa no se muestra aquí, ábrelo en Google Maps.' }),
          ),
        ),
      ),
    ),

    el('div', { className: 'form-grid two' },
      el('div', {},
        el('label', { htmlFor: ids.type, textContent: 'Tipo' }),
        el('select', { id: ids.type },
          el('option', { value: 'Comida', textContent: '🐷 Comida' }),
          el('option', { value: 'Visitar', textContent: '🚗 Visitar' }),
        ),
      ),
      el('div', {},
        el('label', { htmlFor: ids.time, textContent: 'Horario' }),
        el('select', { id: ids.time },
          el('option', { value: 'Día', textContent: '🌤️ Día' }),
          el('option', { value: 'Tarde', textContent: '☀️ Tarde' }),
          el('option', { value: 'Noche', textContent: '🌑 Noche' }),
        ),
      ),
    ),

    el('div', { className: 'form-grid two' },
      el('div', {},
        el('label', { htmlFor: ids.status, textContent: 'Estatus' }),
        el('select', { id: ids.status, onchange: setStatusUI },
          el('option', { value: 'Pendiente', textContent: '🔴 Pendiente' }),
          el('option', { value: 'Completado', textContent: '🟢 Completado' }),
        ),
      ),
      el('div', { 'data-go-again': '', style: `display:${(plan?.status ?? 'Pendiente') === 'Completado' ? '' : 'none'}` },
        el('label', { htmlFor: ids.goAgain, textContent: '¿Ir otra vez?' }),
        el('select', { id: ids.goAgain },
          el('option', { value: 'Sí', textContent: 'Sí' }),
          el('option', { value: 'No', textContent: 'No' }),
        ),
        el('div', { className: 'help', textContent: 'Solo aplica cuando el estatus es Completado.' }),
      ),
    ),

    el('div', { 'data-rating': '', style: `display:${(plan?.status ?? 'Pendiente') === 'Completado' ? '' : 'none'}` },
      el('label', { textContent: 'Calificación' }),
      renderStars(ratingRootId, currentRating),
      el('div', { className: 'help', textContent: '1 a 5 estrellas. (En Pendiente se oculta y se guarda como 0.)' }),
    ),

    el('div', { className: 'row space' },
  el('button', { className: 'btn primary', type: 'submit', textContent: isEditing ? 'Guardar cambios' : 'Registrar' }),
      el('button', {
        className: 'btn',
        type: 'button',
        textContent: 'Limpiar',
        onclick: () => {
          state.editingId = null;
          render();
        },
      }),
    ),
  );

  // set default selected values after creation
  queueMicrotask(() => {
    if (!isEditing) {
      document.getElementById(ids.type).value = 'Comida';
      document.getElementById(ids.time).value = 'Día';
      document.getElementById(ids.status).value = 'Pendiente';
      setStatusUI();
    } else if (plan) {
      document.getElementById(ids.type).value = plan.type;
      document.getElementById(ids.time).value = plan.time;
      document.getElementById(ids.status).value = plan.status;
      document.getElementById(ids.goAgain).value = plan.goAgain;
      setStatusUI();
    }

    updateMapPreview();
  });

  return form;
}

function renderStars(rootId, initial) {
  const hidden = el('input', { type: 'hidden', name: 'rating', value: String(initial) });

  const starButtons = Array.from({ length: 5 }).map((_, i) => {
    const val = i + 1;
    const pressed = val <= initial;
    return el('button', {
      type: 'button',
      className: 'star',
      'data-star': String(val),
      'aria-label': `${val} estrella${val > 1 ? 's' : ''}`,
      'aria-pressed': pressed ? 'true' : 'false',
      textContent: '★',
      onclick: () => {
        hidden.value = String(val);
        document.querySelectorAll(`#${rootId} [data-star]`).forEach((b) => {
          const s = Number(b.getAttribute('data-star'));
          b.setAttribute('aria-pressed', s <= val ? 'true' : 'false');
        });
      },
    });
  });

  return el('div', { id: rootId, className: 'stars' }, hidden, ...starButtons);
}

function renderPlanList(plans) {
  if (!plans.length) {
    return el('div', { className: 'small', textContent: 'Aún no hay planes con esos filtros.' });
  }

  // Compact grid (mobile-friendly)
  if (state.viewMode === 'compact') {
    const grid = el('div', { className: 'plan-grid' },
      ...plans.map((p) => {
        const { typeEmoji, timeEmoji } = getPlanEmojis(p);
        const title = `${typeEmoji}${timeEmoji} ${p.place}`;
        const statusClass = p.status === 'Completado' ? 'is-done' : 'is-pending';

        // Reuse the same `details.plan` styling, but keep it compact.
        // In compact mode we collapse actions/meta via CSS inside `.plan-grid`.
        return el('details', {
          className: `plan plan--compact ${statusClass}`,
          open: false,
          'data-plan-id': p.id,
        },
          el('summary', {
            className: 'plan-summary',
            title,
            onclick: (e) => {
              // Prevent <details> from toggling; instead jump to full list view.
              e.preventDefault();
              state.viewMode = 'list';
              render();
              queueMicrotask(() => {
                const d = document.querySelector(`details.plan[data-plan-id="${CSS.escape(p.id)}"]`);
                if (d) {
                  d.setAttribute('open', '');
                  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            },
          },
            el('div', { className: 'plan-summary-left' },
              el('div', { style: 'min-width:0' },
                el('h3', { textContent: title }),
                el('div', { className: 'small', textContent: p.location }),
              ),
            ),
          ),
        );
      }),
    );

    return grid;
  }

  const formatDateDMY = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const root = el('div', { className: 'list' },
    ...plans.map((p) => {
      const statusClass = p.status === 'Completado' ? 'is-done' : 'is-pending';

      const ratingText = p.status === 'Completado' ? `${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}` : '—';

      const isFav = Boolean(p.isFavorite);

    const { typeEmoji, timeEmoji } = getPlanEmojis(p);
    const typeLabel = p.type === 'Comida' ? '🐷 Comida' : '🚗 Visitar';
    const timeLabel = `${timeEmoji} ${p.time}`;
    const titlePrefix = `${typeEmoji}${timeEmoji} `;

      // Accordion card
      return el('details', { className: `plan ${statusClass}`, open: false, 'data-plan-id': p.id },
        el('summary', { className: 'plan-summary' },
          el('div', { className: 'plan-summary-left' },
            el('span', { className: 'drag-handle', title: 'Arrastra para cambiar prioridad', textContent: '⋮⋮', 'data-drag-handle': '' }),
            el('div', {},
              el('h3', { textContent: `${titlePrefix}${p.place}` }),
              el('div', { className: 'small', textContent: p.location }),
            ),
          ),
          el('div', { className: 'plan-summary-right' },
            el('button', {
              className: `icon-btn ${isFav ? 'fav' : ''}`,
              type: 'button',
              title: 'Favorito',
              'aria-label': 'Favorito',
              onclick: (e) => {
                e.preventDefault();
                const next = { ...p, isFavorite: !Boolean(p.isFavorite) };
                upsertPlanCloud(next);
                toast(next.isFavorite ? 'Agregado a favoritos.' : 'Quitado de favoritos.');
                render();
              },
              textContent: isFav ? '★' : '☆',
            }),
          ),
        ),
        el('div', { className: 'meta meta--singleline' },
          el('span', { className: 'pill', textContent: typeLabel }),
          el('span', { className: 'pill', textContent: timeLabel }),
          p.status === 'Completado' ? el('span', { className: 'pill ok', textContent: `Ir otra vez: ${p.goAgain}` }) : null,
          p.status === 'Completado' ? el('span', { className: 'pill', textContent: `Calificación: ${ratingText}` }) : null,
        ),
        el('div', { className: 'plan-actions' },
          (p.googleMapLink ? el('button', {
            className: 'icon-action map',
            type: 'button',
            title: 'Abrir en Maps',
            'aria-label': 'Abrir en Google Maps',
            // Use inline SVG (map pin) instead of emoji for a polished icon
            innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>',
            onclick: (e) => {
              e.preventDefault();
              const raw = p.googleMapLink || '';
              let openUrl = raw;
              try { new URL(raw); } catch (err) { openUrl = 'https://www.google.com/maps?q=' + encodeURIComponent(raw || ''); }
              if (openUrl) window.open(openUrl, '_blank', 'noopener');
            },
          }) : null),
          el('button', {
            className: 'icon-action',
            type: 'button',
            title: 'Editar',
            'aria-label': 'Editar',
            textContent: '✏️',
            onclick: () => {
              state.editingId = p.id;
              state.homeTab = 'new';
              window.scrollTo({ top: 0, behavior: 'smooth' });
              render();
            },
          }),
          el('button', {
            className: 'icon-action danger',
            type: 'button',
            title: 'Borrar',
            'aria-label': 'Borrar',
            textContent: '🗑️',
            onclick: async () => {
              const ok = await confirmModal({
                title: 'Borrar plan',
                message: `¿Borrar “${p.place}”?`,
                confirmText: 'Borrar',
                cancelText: 'Cancelar',
              });
              if (!ok) return;
              await deletePlanCloud(p.id);
              toast('Plan borrado.');
              render();
            },
          }),
        ),
        p.status === 'Completado'
          ? el('div', { className: 'small', textContent: `Completado el ${formatDateDMY(p.completedAt)}` })
          : null,
      );
    }),
  );

  // Attach drag handlers after mount
  queueMicrotask(() => {
    // Force collapsed by default (some browsers may restore <details> open state)
    root.querySelectorAll('details.plan[open]').forEach((d) => d.removeAttribute('open'));
    setupDragAndDrop(root, plans);
  });
  return root;
}

// logs UI removed

function exportJson() {
  const payload = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    plans: state.plans,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `couple-plans-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exportado.');
}

function importJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const plans = Array.isArray(data?.plans) ? data.plans : Array.isArray(data) ? data : null;
      if (!plans) throw new Error('JSON inválido.');

      // Minimal validation & merge
      let imported = 0;
      for (const raw of plans) {
        try {
          const normalized = sanitizePlanInput({
            ...raw,
            id: raw.id ?? crypto.randomUUID(),
            createdAt: raw.createdAt ?? new Date().toISOString(),
          });
          upsertPlan(normalized);
          imported++;
        } catch {
          // skip bad items
        }
      }
      state.plans = Storage.getPlans();
      toast(`Importados: ${imported}`);
      render();
    } catch (err) {
      toast(err?.message || 'No se pudo importar.');
    }
  };
  input.click();
}

function renderFooter() {
  return el('footer', { className: 'footer' },
    el('div', { className: 'row space' },
      el('span', { textContent: `Couple Plans · v${APP_VERSION} · ${new Date().getFullYear()}` }),
      el('span', { className: 'small', textContent: state.cloudReady ? 'Sincronizado.' : '' }),
    ),
  );
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  app.appendChild(renderTopbar());

  const route = getRoute();
  if (route === 'login' || !state.session) {
    app.appendChild(renderLogin());
  } else {
    app.appendChild(renderHome());
  }

  app.appendChild(renderFooter());

  let toastNode = document.querySelector('[data-toast]');
  if (!toastNode) {
    toastNode = document.createElement('div');
    toastNode.className = 'toast';
    toastNode.setAttribute('data-toast', '');
    document.body.appendChild(toastNode);
  }
}

load();

// Theme: light by default, persisted
setTheme(getTheme());

// Realtime Auth
cloud.onAuth(async (userOrInfo) => {
  if (!userOrInfo) {
    state.user = null;
    state.session = null;
    state.cloudReady = false;
    setRoute('login');
    render();
    return;
  }

  if (userOrInfo?.notAllowed) {
    toast('Esta cuenta no está autorizada para este proyecto.');
    await cloud.signOut();
    return;
  }

  const user = userOrInfo;
  state.user = user;
  // Assign role based on known test emails
  const email = (user.email || '').toLowerCase();
  let role = 'Usuario';
  if (email === (USER_EMAILS.michel || '').toLowerCase()) role = 'Administrador';
  else if (email === (USER_EMAILS.sarahi || '').toLowerCase()) role = 'Usuario';

  state.session = { username: user.displayName || user.email || 'Usuario', email: user.email || '', role };
  // Expose state for quick debugging in DevTools
  try { window.__CP_STATE = state; } catch (e) {}
  // Debug trace to check role assignment
  try { console.debug('cloud.onAuth -> email:', email, 'assignedRole:', role, 'user:', user); } catch (e) {}
  state.cloudReady = true;
  setRoute('home');
  render();

  // No-op: sign-in logging removed

  // Start realtime listeners once
  if (!cloud._listening) {
    cloud._listening = true;

    cloud.onLocations((locs) => {
      state.locations = locs;
      // keep local mirror (optional)
      saveLocations();
      render();
    });

    cloud.onPlans((plans) => {
      // Firestore timestamps may be objects; normalize for UI
      // Preserve createdBy/ownerKey from local storage when available so our
      // local migration isn't overwritten by remote docs that lack those fields.
      const localStored = Storage.getPlans();
      state.plans = plans.map((p) => {
        const normalized = {
          ...p,
          createdAt: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : p.createdAt,
          updatedAt: p.updatedAt?.toDate ? p.updatedAt.toDate().toISOString() : p.updatedAt,
          completedAt: p.completedAt?.toDate ? p.completedAt.toDate().toISOString() : p.completedAt,
        };

        const local = Array.isArray(localStored) ? localStored.find((lp) => lp.id === normalized.id) : null;
        // prefer local.createdBy if present, else remote, else null
        const createdBy = (local && local.createdBy) ? local.createdBy : (normalized.createdBy || null);
        const ownerKey = (local && local.ownerKey)
          ? local.ownerKey
          : (normalized.ownerKey || getOwnerKey({ createdBy }) || getOwnerKey(normalized));

        return { ...normalized, createdBy, ownerKey };
      });
      savePlans();
      render();
    });
  }

  // logs feature removed: no subscription performed
});

// Ensure login is the default route until auth resolves
if (!state.session) setRoute('login');
render();

// logs feature removed — no startup subscription
