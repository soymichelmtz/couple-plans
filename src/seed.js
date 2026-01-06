import { Storage } from './storage.js';
import { DEFAULT_LOCATIONS } from './locations.js';

export const DEFAULT_USERS = [
  { username: 'michel', password: '1234' },
  { username: 'sarahi', password: '1234' },
];

export function seedIfEmpty() {
  const users = Storage.getUsers();
  if (!users.length) Storage.setUsers(DEFAULT_USERS);

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
