# SIMOUN Conciliaciones — acceso independiente

Fuente de la app de conciliaciones, publicada en `/simoun-control/conciliaciones/` mediante GitHub Pages. La app operativa de la raíz se conserva.

## Desarrollo

`npm ci` · `npm run typecheck` · `node test-cfdi.cjs` · `node test-restore.cjs` · `node test-workflows.cjs` · `npm run build`.
El build genera `../conciliaciones/`. Se publican tanto fuente como build y lockfile; nunca expedientes ni credenciales privadas.

## Datos y acceso

Supabase Auth con correo confirmado y contraseña. Tablas separadas `simoun_recon_*`, bucket privado `simoun-conciliaciones`. La función de autorización está en un esquema no expuesto, consulta únicamente la identidad autenticada y requiere el correo principal confirmado. La clave publishable del cliente no concede acceso sin autenticación. Historial de snapshots en cada guardado y control de versión para evitar sobrescrituras desde pestañas desactualizadas.

La cuenta principal configura su contraseña desde la pantalla de acceso. La confirmación y recuperación dependen de que Supabase pueda enviar correo. Redirección deseada: `https://simounconia.github.io/simoun-control/conciliaciones/`. Si no está incluida en Auth URL Configuration, puede confirmarse el correo y regresar a la app, o pegar el enlace original en «Tengo un enlace de confirmación». Este último flujo verifica el token directamente y también permite recuperación sin depender de una redirección.

## Traslado de la app anterior

Descargar «Respaldo completo» de la app privada anterior e importar el ZIP en «Respaldos y traslado». No se migra información sin la sesión del propietario. Se conservan identificadores y archivos; repetir la importación no crea copias. Las diferencias con registros ya existentes bloquean la importación. Las cargas interrumpidas pueden retomarse con el mismo ZIP. La app anterior conserva todos sus datos.

## Instalación

Manifest de aplicación y service worker con ámbito limitado a esta carpeta. No se guardan respuestas de autenticación, expedientes ni adjuntos en Cache Storage. Necesita conexión a internet.
