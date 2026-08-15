# SK Store

Tienda de juegos independientes (estilo Play Store) hecha en **JavaScript puro**.  
Pensada para subirse a **GitHub Pages**.

---

## Cómo subir un juego (automático)

1. Crea una carpeta dentro de `games/` con el nombre del juego  
   Ejemplo: `games/MiJuego/`
2. Dentro pon:
   - El archivo `.apk`
   - Un `README.md` con la descripción
3. Sube los cambios a GitHub (`git add` + `git commit` + `git push`)
4. La página detecta sola el nuevo juego (usa la API de GitHub)

No necesitas tocar ningún archivo de código.

---

## Configuración obligatoria (solo una vez)

Abre `main.js` y cambia estas dos líneas al principio:

```js
const GITHUB_USER = 'TU_USUARIO_DE_GITHUB';   // tu usuario de GitHub
const GITHUB_REPO = 'sk-store';                // el nombre de tu repositorio
```

---

## Cuenta de administrador

**Usuario:** `1eracuentasecundariadegd@gmail.com`

La contraseña **no** está en el código.  
Se lee del archivo `myaccount.txt` que está en la raíz del proyecto.

1. Abre `myaccount.txt`
2. Borra el texto que hay y escribe **solo** tu contraseña (una sola línea)
3. Guarda y sube el archivo a GitHub

### ⚠️ ADVERTENCIA DE SEGURIDAD

Como el sitio está en GitHub Pages, el archivo `myaccount.txt` es **público**.  
Cualquiera puede verlo si conoce la URL.  

**Usa una contraseña que NO uses en ningún otro sitio.**  
Esta es solo para tu tienda personal.

---

## Login y registro

- Usuarios normales: eligen nombre de usuario + contraseña
- Pueden dejar un **correo opcional** (recomendado)
- Beneficio del correo: tú (como admin) podrás verlo en la bandeja de mensajes y escribirles cuando aceptes/rechaces su solicitud de beta tester
- Nunca se pide la contraseña del correo

---

## Bandeja de mensajes

Solo aparece cuando inicias sesión con:

```
1eracuentasecundariadegd@gmail.com
```

En cada solicitud verás:
- Nombre del juego
- Nombre de usuario que la pidió
- **Su correo** (si lo dejó) → puedes hacer clic y se abre tu Gmail para escribirle

---

## Estructura de archivos

```
./
├── index.html
├── main.js
├── style.css
├── manifest.json
├── myaccount.txt      ← aquí va TU contraseña (solo la contraseña)
├── README.md
└── games/
    ├── Malakias/
    │   ├── Malakias.apk
    │   └── README.md
    └── PixelRunner/
        ├── PixelRunner.apk
        └── README.md
```

---

## Cómo publicar en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube todos estos archivos
3. Ve a **Settings → Pages**
4. Source: **Deploy from a branch** → branch `main` → carpeta `/ (root)`
5. En unos minutos estará en:  
   `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`

Recuerda configurar `GITHUB_USER` y `GITHUB_REPO` en `main.js`.

---

## Notas

- Todo es JavaScript puro (sin Python, sin backend)
- Los contadores, comentarios y solicitudes se guardan en el navegador de cada persona
- El icono de mensajes **solo** lo ves tú como administrador
