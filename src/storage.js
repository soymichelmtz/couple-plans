const KEYS = {
  USERS: 'cp.users',
  SESSION: 'cp.session',
  PLANS: 'cp.plans',
  LOCATIONS: 'cp.locations',
};

export const Storage = {
  getUsers() {
    try {
      const raw = localStorage.getItem(KEYS.USERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  setUsers(users) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  getSession() {
    try {
      const raw = localStorage.getItem(KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setSession(session) {
    localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
  },
  clearSession() {
    localStorage.removeItem(KEYS.SESSION);
  },

  getPlans() {
    try {
      const raw = localStorage.getItem(KEYS.PLANS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  setPlans(plans) {
    localStorage.setItem(KEYS.PLANS, JSON.stringify(plans));
  },

  getLocations() {
    try {
      const raw = localStorage.getItem(KEYS.LOCATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  setLocations(locations) {
    localStorage.setItem(KEYS.LOCATIONS, JSON.stringify(locations));
  },
};
