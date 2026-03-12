SISTEMA PARTE DIARIO - SANTA TERESA BAJO

Que incluye esta version:
- App web responsive para celular, tablet y PC.
- Modulo de trabajadores, labores y campos.
- Parte diario por fecha.
- Agregar filas de personal.
- Guardar, cerrar, reabrir, copiar dia anterior.
- Impresion o generacion de PDF desde el navegador.
- Reportes y exportacion CSV.
- Respaldo JSON.
- Guardado local en el navegador y sincronizacion con SQLite cuando se ejecuta con Node.js.

Como usar (modo recomendado con base de datos):
1. Instala dependencias: npm install
2. Inicia el servidor: npm start
3. Abre http://localhost:3000 en el navegador.
4. Registra trabajadores, labores y campos.
5. Ve a Parte diario.
6. Selecciona una fecha y pulsa "Abrir o crear".
7. Agrega filas y completa los datos.
8. Guarda o cierra el parte.
9. Usa "Imprimir o PDF" para sacar el formato final.

Modo rapido (solo local):
1. Abre index.html en el navegador.
2. Registra trabajadores, labores y campos.
3. Ve a Parte diario.
4. Selecciona una fecha y pulsa "Abrir o crear".
5. Agrega filas y completa los datos.
6. Guarda o cierra el parte.
7. Usa "Imprimir o PDF" para sacar el formato final.

Publicar para usar desde cualquier lugar (sin prender tu PC):
1. Sube el proyecto a GitHub.
2. Crea un Web Service en Render (o Railway).
3. Build Command: npm install
4. Start Command: npm start
5. Agrega variables de entorno:
   AUTH_USER=tu_usuario
   AUTH_PASS=tu_clave_segura
   DATA_DIR=/var/data
6. Agrega un disco persistente y montalo en /var/data.
7. Abre la URL publica que te entregue la plataforma (https://...).

Recomendacion para usarlo como app instalable:
- Sirvelo desde un hosting o servidor web para que el navegador permita instalarlo y usar el service worker.
- Opciones simples: Netlify, Vercel, GitHub Pages, hosting compartido o un servidor interno.

Importante:
- Esta es una primera version MVP.
- No tiene login real multiusuario.
- Cuando se ejecuta con Node.js, guarda en SQLite local del servidor (archivo data/parte-diario.db).
- Si no hay servidor disponible, sigue guardando localmente en el dispositivo.
- Tiene login simple con sesion.
  Usuario por defecto: admin
  Contrasena por defecto: 123456
  Puedes cambiarlos con variables de entorno AUTH_USER y AUTH_PASS.
