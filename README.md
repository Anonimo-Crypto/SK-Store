# SK Store

Tienda de juegos y apps independientes estilo Play Store.  
JavaScript puro + Firebase (sincronización real) + GitHub Pages.

---

## Cómo añadir un juego o app

1. Crea una carpeta dentro de `games/` o `apps/`
2. Dentro coloca:
   - El archivo `.apk`
   - `README.md` (descripción)
   - `Portada.png` (imagen de portada)
   - `Developer.txt` (nombre del desarrollador)
3. Sube los cambios a GitHub
4. La página los detectará automáticamente

---

## Configurar Firebase (sincronización real)

Para que descargas, usuarios, comentarios y betas se compartan entre todos:

1. Entra en [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto (o usa uno existente)
3. Añade una app web y copia la configuración
4. Activa **Firestore Database** (modo de prueba al crear)
5. En **Reglas** de Firestore pega esto (solo para uso personal/demo):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. Abre `main.js` y pega tu config en `FIREBASE_CONFIG`:

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Sin Firebase configurado, la tienda sigue funcionando con datos locales del navegador.

---

## Publicar en GitHub Pages

1. Sube el proyecto a GitHub
2. Settings → Pages → Deploy from branch `main` → `/ (root)`

---

## Estructura

```
./
├── index.html
├── main.js
├── style.css
├── manifest.json
├── README.md
├── games/
│   └── Nombre/
│       ├── .apk, README.md, Portada.png, Developer.txt
└── apps/
    └── Nombre/
        ├── .apk, README.md, Portada.png, Developer.txt
```
