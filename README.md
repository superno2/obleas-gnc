# Registro GNC

Beta local y base inicial para publicar la app en la nube.

## Archivos principales

- `index.html`: app actual.
- `config.js`: datos publicos de Supabase para conectar la app.
- `config.example.js`: ejemplo de configuracion.
- `supabase-schema.sql`: tablas y reglas iniciales para Supabase.
- `vercel.json`: configuracion minima para Vercel.

## Paso 1: Supabase

1. Entrar a Supabase.
2. Crear un proyecto nuevo.
3. Ir a `SQL Editor`.
4. Copiar y ejecutar el contenido de `supabase-schema.sql`.
5. Ir a `Project Settings > API`.
6. Copiar:
   - Project URL.
   - anon public key.

## Paso 2: Configurar la app

Abrir `config.js` y completar:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_CLAVE_ANON_PUBLICA"
};
```

No usar la `service_role key` en el navegador.

## Paso 3: GitHub

1. Crear un repositorio nuevo.
2. Subir estos archivos.
3. Confirmar que `index.html`, `config.js`, `vercel.json` y `supabase-schema.sql` quedaron en el repositorio.

## Paso 4: Vercel

1. Entrar a Vercel.
2. Crear `New Project`.
3. Importar el repositorio de GitHub.
4. Publicar.
5. Abrir la URL generada por Vercel.

## Siguiente etapa tecnica

La app todavia guarda datos en el navegador. El siguiente trabajo es conectar `index.html` con Supabase para:

- Login real.
- Guardado online.
- Adjuntos online.
- Sincronizacion entre equipos.
- Preparacion para usuarios y suscripciones.
