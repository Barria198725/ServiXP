# ServiXP API en Docker

La aplicación usa una API Node.js y PostgreSQL. Los perfiles profesionales y las fotos/documentos se guardan con la API y en volúmenes persistentes de Docker.

## Inicio local

1. Docker Desktop debe estar activo.
2. Inicia o actualiza la API y la base de datos desde la raíz del proyecto:

   ```powershell
   docker compose up --build -d api db
   docker compose ps
   ```

3. En navegador y simuladores, `EXPO_PUBLIC_API_URL=http://localhost:4000` funciona. En un teléfono físico configura `EXPO_PUBLIC_API_URL` y `API_PUBLIC_URL` con la IP local de la computadora, por ejemplo `http://192.168.1.25:4000`; teléfono y computadora deben estar en la misma red. Reinicia Expo después de cambiar la variable. La app intenta adaptar `localhost` al host de Expo durante el desarrollo nativo.
4. Inicia Expo desde otra terminal:

   ```powershell
   npx expo start
   ```

## Acceso

Clientes y profesionales se registran con correo o nickname y contraseña. El registro guarda la cuenta y devuelve al Login con el identificador listo para iniciar sesión. Los clientes completan además su fecha de nacimiento; los profesionales completan su perfil de servicio. El Login consulta la API y dirige cada rol a su pantalla de inicio.

Las cuentas antiguas de cliente verificadas que no tenían contraseña se pueden actualizar completando el registro otra vez con el mismo correo. Las fotos y documentos tienen un límite de 5 MB; se admiten JPG, PNG, WEBP y PDF.

## Datos y archivos

- PostgreSQL conserva cuentas, perfiles y referencias a archivos en `postgres_data`.
- `uploads_data` conserva fotos y documentos. Documentos de identidad y certificados se cifran antes de guardarse.
- `FILE_ENCRYPTION_KEY` debe respaldarse de forma segura; perderla impide recuperar los documentos privados cifrados.

## Comandos útiles

```powershell
docker compose logs -f api
docker compose logs -f db
docker compose down
```

`docker compose down` conserva los volúmenes `postgres_data` y `uploads_data`. **No uses `docker compose down -v`** salvo que quieras borrar permanentemente la base de datos y todos los archivos almacenados.

## Rutas principales

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/users/me/profile-photo`
- `POST /api/providers/me/files` (sesión profesional requerida)
- `GET /api/providers?category=Plomeros`
- `GET /api/providers/me/files` (sesión profesional requerida)
- `GET /api/providers/me/files/:id/download` (documento privado, propietario requerido)