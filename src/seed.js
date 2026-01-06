import { Storage } from './storage.js';
import { DEFAULT_LOCATIONS } from './locations.js';

export const DEFAULT_USERS = [
  // Nota: no incluimos contraseñas reales en el repo.
  // En modo local, el seed solo existe para sugerir usuarios; la contraseña
  // la defines tú al primer uso (o puedes migrar a Firebase Auth).
  { username: 'michel', password: '' },
  { username: 'sarahi', password: '' },
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
