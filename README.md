# PORTAFOLIO ULA — DESARROLLO DE APLICACIONES

Portafolio académico en HTML + CSS + JavaScript conectado a Supabase.

## Incluye

- Página pública del portafolio.
- Datos del estudiante:
  - ESPINAL HUAMAN LUIS
  - P01898G
  - UNIVERSIDAD PERUANA LOS ANDES
  - INGENIERÍA DE SISTEMAS
  - DESARROLLO DE APLICACIONES
- 4 unidades.
- 4 semanas por unidad.
- Filtros por unidad y semana.
- Publicación de archivos y enlaces.
- Panel Admin.
- Login con Supabase Auth.
- Crear, editar y borrar trabajos.
- Supabase Storage para archivos.
- Seguridad con RLS.

## 1. Configuración de Supabase

El proyecto ya está configurado en `js/config.js` con el Project URL y la clave publishable que proporcionaste.

IMPORTANTE: una clave `sb_publishable_...`/anon es apropiada para el frontend cuando las tablas y Storage tienen RLS correctamente configurado. NO pongas una `service_role` key en estos archivos.

## 2. Crear las tablas y Storage

1. Abre tu proyecto en Supabase.
2. Entra a `SQL Editor`.
3. Crea una consulta nueva.
4. Copia todo el contenido de `sql/setup.sql`.
5. Ejecuta la consulta.

Esto crea:
- `profiles`
- `works`
- políticas RLS
- bucket público `trabajos`
- políticas para que solo un admin pueda subir/editar/borrar.

## 3. Crear tu cuenta de administrador

1. Abre `admin.html` desde un servidor local.
2. Usa "Crear cuenta".
3. Confirma el correo si tu configuración de Supabase lo solicita.
4. En Supabase entra a `Authentication > Users`.
5. Copia el UUID de tu usuario.
6. En SQL Editor ejecuta:

```sql
update public.profiles
set role = 'admin',
    full_name = 'ESPINAL HUAMAN LUIS',
    university_code = 'P01898G'
where id = 'TU-UUID-AQUI';
```

7. Vuelve a `admin.html` e inicia sesión.

## 4. Cómo probarlo en tu PC

No abras el HTML directamente con `file://` si el navegador bloquea recursos. Usa un servidor local.

Con VS Code:
- instala Live Server
- clic derecho en `index.html`
- `Open with Live Server`

O con Python:

```bash
python -m http.server 5500
```

Luego entra a:
`http://localhost:5500`

## 5. Publicarlo

Puedes subir esta carpeta a GitHub Pages, Netlify o Vercel.

Si usas GitHub Pages, la parte pública funcionará como sitio estático. El panel Admin también puede funcionar porque Auth y Storage están en Supabase.

## 6. Archivos admitidos

El input de archivos permite seleccionar cualquier tipo que tu navegador/Storage acepte. El límite configurado en el SQL es de 50 MB por archivo.

Puedes publicar:
- PDF
- DOC/DOCX
- XLS/XLSX
- PPT/PPTX
- ZIP/RAR
- imágenes
- archivos de código
- otros archivos académicos

También puedes publicar solamente un enlace externo.

## Estructura

- `index.html` — portafolio público.
- `admin.html` — panel administrativo.
- `css/style.css` — diseño gamer.
- `js/config.js` — configuración Supabase.
- `js/app.js` — portada y trabajos.
- `js/admin.js` — login y CRUD.
- `sql/setup.sql` — tablas, RLS y Storage.
