import { Storage } from './storage.js';
import { DEFAULT_LOCATIONS } from './locations.js';

export const DEFAULT_USERS = [
  // Placeholder local users (no passwords committed). If you still use local login,
  // set your own passwords locally (do NOT commit them).
  { username: 'michel', password: '' },
  { username: 'sarahi', password: '' },
];

export function seedIfEmpty() {
  const users = Storage.getUsers();
  // Important: do NOT seed passwords into storage from the repository.
  // If you want local-login users, set them manually in your browser storage.
  if (!users.length) Storage.setUsers([]);

  const locations = Storage.getLocations();
  if (!locations.length) Storage.setLocations(DEFAULT_LOCATIONS);

  const plans = Storage.getPlans();
  if (!plans.length) {
    Storage.setPlans([
      {
        id: crypto.randomUUID(),
        place: 'Mirador Obispado',
        type: 'Visitar',
        time: 'Noche',
        status: 'Pendiente',
        location: 'Monterrey, Nuevo León, México',
        rating: 0,
        goAgain: 'No',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        completedBy: null,
      },
    ]);
  }
}
