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

## Datos

Los planes se guardan en este navegador usando `localStorage`.

- En el **mismo navegador/perfil**, ambos usuarios verán la misma lista (son “planes compartidos”).
- Para compartir entre **dos celulares** o **dos laptops** diferentes, necesitaríamos sincronización con un backend.

## 🔥 Firebase (sincronización multi-dispositivo)

Si ya creaste el proyecto y Firestore, falta conectar la app:

1) En Firebase Console: Project settings → Your apps → Web app → copia el objeto **firebaseConfig**.
2) Pégalo en `src/firebase-config.js`.

Archivo de referencia: `src/firebase-config.example.js`.

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

## Datos

Los planes se guardan en este navegador usando `localStorage`.

- En el **mismo navegador/perfil**, ambos usuarios verán la misma lista (son “planes compartidos”).
- Para compartir entre **dos celulares** o **dos laptops** diferentes, necesitaríamos sincronización con un backend.

## 🔥 Firebase (sincronización multi-dispositivo)

Si ya creaste el proyecto y Firestore, falta conectar la app:

1) En Firebase Console: Project settings → Your apps → Web app → copia el objeto **firebaseConfig**.
2) Pégalo en `src/firebase-config.js`.

Archivo de referencia: `src/firebase-config.example.js`.

### Login (2 usuarios)

La UI pide **usuario** y **contraseña**, pero por debajo Firebase Auth requiere cuentas **Email/Password**.

- Crea **2 usuarios** en Firebase Console → Authentication → Users.
- Puedes usar emails “internos” como placeholders, por ejemplo: `usuario1@tu-app.local` y `usuario2@tu-app.local`.

> La protección real la hacen las reglas de Firestore (`firestore.rules`).

- Exporta para respaldar.
- Importa para migrar entre laptops/navegadores.

---

## Vista previa local (recomendado)

Para ver la app tal como se sirve en un hosting estático, arranca un servidor HTTP en la raíz del repositorio y abre:

```
http://127.0.0.1:5173/?view=home
```

Ejemplo (PowerShell):

```powershell
# desde la carpeta del proyecto
python -m http.server 5173 --bind 127.0.0.1
# luego abre http://127.0.0.1:5173/?view=home en el navegador
```

Notas:
- Si `localhost:5173` no responde, prueba con `127.0.0.1:5173` (en Windows a veces hay diferencias de resolución).
- El `sw.js` incluido es mínimo y no hace caching agresivo; está para evitar errores 404 y servir como base para PWA.

Controles UI recientes
- Los botones de orden ahora muestran iconos A↑ (orden ascendente) y Z↓ (orden descendente) cerca de la esquina superior derecha de la lista; la caja de controles (`.view-toggle`) se alinea a la derecha.
- El logo de la app está en `assets/couple-plans.svg`.
