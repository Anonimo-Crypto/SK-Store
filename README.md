# SK Store

Tienda de juegos independientes estilo Play Store.  
Hecha en JavaScript puro y pensada para GitHub Pages.

---

## Cómo añadir un juego

1. Crea una carpeta dentro de `games/` (ejemplo: `games/MiJuego/`)
2. Dentro de la carpeta coloca:
   - El archivo `.apk`
   - Un `README.md` con la descripción del juego
   - Una imagen `Portada.png` (será la portada del juego)
3. Sube los cambios a GitHub
4. La página detectará el juego automáticamente

---

## Estructura

```
./
├── index.html
├── main.js
├── style.css
├── manifest.json
├── README.md
└── games/
    └── NombreDelJuego/
        ├── NombreDelJuego.apk
        ├── README.md
        └── Portada.png
```

---

## Publicar en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub
2. Ve a **Settings → Pages**
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. La página quedará disponible en la URL de GitHub Pages

---

## Notas

- Los datos de usuarios, comentarios y descargas se guardan en el navegador
- Incluye modo oscuro (se recuerda la preferencia)
- Compatible con PWA
