import { initFirebase, Firebase } from './firebase.js';

/**
 * Cloud data model (single shared workspace):
 *
 * /workspaces/shared
 *   - locations: string[]
 *
 * /workspaces/shared/plans/{planId}
 *   - place, type, time, status, location, rating, goAgain
 *   - createdAt, updatedAt (timestamps)
 *   - completedAt, completedBy
 */

const WORKSPACE_ID = 'shared';

function requireEmailAllowed(email, allowedEmails) {
  const e = String(email || '').toLowerCase();
  return allowedEmails.some((x) => String(x).toLowerCase() === e);
}

export function createCloud(allowedEmails) {
  const { auth, db } = initFirebase();

  const workspaceRef = () => Firebase.doc(db, 'workspaces', WORKSPACE_ID);
  const plansCol = () => Firebase.collection(db, 'workspaces', WORKSPACE_ID, 'plans');

  return {
    auth,
    db,

    onAuth(callback) {
      return Firebase.onAuthStateChanged(auth, (user) => {
        if (!user) return callback(null);
        if (!requireEmailAllowed(user.email, allowedEmails)) {
          // Signed in but not allowed.
          callback({ notAllowed: true, user });
          return;
        }
        callback(user);
      });
    },

    async signIn(email, password) {
      return Firebase.signInWithEmailAndPassword(auth, email, password);
    },

    async signOut() {
      return Firebase.signOut(auth);
    },

    // Locations array stored in workspace doc
    onLocations(callback) {
      return Firebase.onSnapshot(workspaceRef(), (snap) => {
        const data = snap.data();
        callback(Array.isArray(data?.locations) ? data.locations : []);
      });
    },

    async setLocations(locations) {
      const locs = Array.isArray(locations) ? locations : [];
      await Firebase.setDoc(
        workspaceRef(),
        { locations: locs, updatedAt: Firebase.serverTimestamp() },
        { merge: true }
      );
    },

    // Plans as a collection with realtime updates
    onPlans(callback) {
      const q = Firebase.query(plansCol(), Firebase.orderBy('updatedAt', 'desc'));
      return Firebase.onSnapshot(q, (snap) => {
        const plans = [];
        snap.forEach((docSnap) => plans.push({ id: docSnap.id, ...docSnap.data() }));
        callback(plans);
      });
    },

    async upsertPlan(plan) {
      const id = plan.id;
      const ref = Firebase.doc(db, 'workspaces', WORKSPACE_ID, 'plans', id);
      await Firebase.setDoc(
        ref,
        {
          ...plan,
          updatedAt: Firebase.serverTimestamp(),
          createdAt: plan.createdAt ? plan.createdAt : Firebase.serverTimestamp(),
        },
        { merge: true }
      );
    },

    async deletePlan(id) {
      const ref = Firebase.doc(db, 'workspaces', WORKSPACE_ID, 'plans', id);
      await Firebase.deleteDoc(ref);
    },
  };
}
