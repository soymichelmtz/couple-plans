// 1) Copia este archivo como: firebase-config.js
// 2) Pega aquí tu firebaseConfig desde Firebase Console -> Project settings -> Your apps (Web).
//
// IMPORTANTE:
// - Este config NO es un secreto, pero evita commitearlo si no quieres exponer el projectId públicamente.
// - La seguridad real la definen las Reglas de Firestore + Auth.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
