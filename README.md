# Couple Plans

Web app responsive (tipo app) para gestionar planes en pareja: ideas, citas y actividades.

## Qué incluye

- Login local para 2 usuarios (se guarda en `localStorage`)
- Registro de planes con:
  - **Lugar**
  - **Tipo**: Comida / Visitar
  - **Horario**: Día / Tarde / Noche
  - **Estatus**: Pendiente / Completado
  - **Ubicación**
    - Autocomplete (sugerencias) al escribir
    - Vista rápida en mapa (OpenStreetMap)
  - **Calificación**: estrellas 1–5 (solo si está Completado)
  - **Ir otra vez**: Sí / No (solo si está Completado)
- Lista + filtros
- Exportar / Importar JSON

## Cómo usar

Como es una app estática, puedes abrir `index.html` directamente en el navegador.

> Nota: para Firebase (Auth/Firestore) es muy recomendable usar un server local o hosting. Algunos navegadores limitan cosas cuando abres con `file://`.

### Server local (opcional)

Si tienes Node instalado, puedes usar cualquier servidor estático (por ejemplo, la extensión “Live Server” en VS Code) o uno sencillo.

## Usuarios

Por defecto, quedan así (puedes cambiarlos en `src/seed.js`):

- `michel` / `1234`
- `sarahi` / `1234`

> Si ya habías abierto la app antes, puede que tu navegador tenga usuarios viejos guardados.
> En ese caso, limpia el `localStorage` del sitio o abre en una ventana privada para regenerar el seed.

## Datos

Los planes se guardan en este navegador usando `localStorage`.

- En el **mismo navegador/perfil**, ambos usuarios verán la misma lista (son “planes compartidos”).
- Para compartir entre **dos celulares** o **dos laptops** diferentes, necesitaríamos sincronización con un backend.

## 🔥 Firebase (sincronización multi-dispositivo)

Si ya creaste el proyecto y Firestore, falta conectar la app:

1) En Firebase Console: Project settings → Your apps → Web app → copia el objeto **firebaseConfig**.
2) Pégalo en `src/firebase-config.js`.

Archivo de referencia: `src/firebase-config.example.js`.

### Login con usuario (michel / sarahi)

La UI pide **usuario** y **contraseña**, pero por debajo Firebase Auth requiere un “email”.
Usamos estos emails internos (tú los creas en Firebase Auth):

- `michel@couple-plans.local`
- `sarahi@couple-plans.local`

En Firebase Console → Authentication → Users, crea ambos usuarios con Email/Password.

> La protección real la hacen las reglas de Firestore (`firestore.rules`).

- Exporta para respaldar.
- Importa para migrar entre laptops/navegadores.
