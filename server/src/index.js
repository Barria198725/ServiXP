import crypto from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT ?? 4000);
const storageRoot = path.resolve(process.env.FILE_STORAGE_PATH ?? './uploads');
const jwtSecret = process.env.JWT_SECRET;
const fileEncryptionKey = Buffer.from(process.env.FILE_ENCRYPTION_KEY ?? '', 'hex');
const rootDir = path.dirname(fileURLToPath(import.meta.url));

if (!jwtSecret || jwtSecret.length < 48) {
  throw new Error('JWT_SECRET must contain at least 48 characters.');
}
if (fileEncryptionKey.length !== 32) {
  throw new Error('FILE_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 11, fields: 16 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      const error = new Error('Selecciona una imagen compatible o un documento PDF.');
      error.status = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});
const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.API_CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)), allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '128kb' }));

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const providerProfileSchema = z.object({
  phone: z.string().trim().min(6).max(40),
  category: z.string().trim().min(2).max(100),
  specialties: z.string().trim().max(500).default(''),
  description: z.string().trim().min(1).max(250),
  province: z.string().trim().min(2).max(80),
  coverage: z.string().trim().min(2).max(160),
  days: z.string().trim().min(2).max(100),
  hours: z.string().trim().min(2).max(100),
  emergency: z.boolean().default(false),
  experience: z.string().trim().max(30).default(''),
  rateType: z.string().trim().min(2).max(50),
  rate: z.string().trim().max(40).default(''),
  paymentMethods: z.string().trim().min(1).max(200),
  liabilityInsurance: z.boolean().default(false),
});

function responseError(res, status, message) {
  return res.status(status).json({ error: message });
}

function serializeProvider(row, req) {
  const profile = row.profile_data ?? {};
  const publicFiles = row.public_files ?? [];
  const apiBase = (process.env.API_PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const fileUrl = (id) => `${apiBase}/api/public/files/${id}`;
  const profilePhoto = publicFiles.find((file) => file.kind === 'profile_photo');
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    verified: true,
    reviews: row.reviews ?? [],
    profile: {
      ...profile,
      province: row.province,
      profilePhoto: profilePhoto ? fileUrl(profilePhoto.id) : '',
      portfolioPhotos: publicFiles.filter((file) => file.kind === 'portfolio_photo').map((file) => fileUrl(file.id)),
      identityDocument: '',
      certificate: '',
    },
  };
}

function createToken(user) {
  return jwt.sign({ role: user.role, name: user.name, email: user.email }, jwtSecret, { subject: user.id, expiresIn: '7d', issuer: 'servixp-api', audience: 'servixp-app' });
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  try {
    req.auth = jwt.verify(token, jwtSecret, { issuer: 'servixp-api', audience: 'servixp-app' });
    next();
  } catch {
    responseError(res, 401, 'Inicia sesión para continuar.');
  }
}

function requireProvider(req, res, next) {
  if (req.auth?.role !== 'provider') return responseError(res, 403, 'Esta opción es solo para cuentas profesionales.');
  next();
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'servixp-api' });
  } catch {
    responseError(res, 503, 'Database is unavailable.');
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    identifier: z.string().trim().min(3).max(254),
    role: z.enum(['customer', 'provider']),
    password: z.string().min(8).max(128),
    providerProfile: providerProfileSchema.optional(),
    customer: z.object({
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      phone: z.string().trim().max(40).optional().default(''),
    }).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return responseError(res, 400, parsed.error.issues[0]?.message ?? 'Revisa los datos enviados.');
  const { name, role, providerProfile, customer } = parsed.data;
  const identifier = parsed.data.identifier.toLowerCase();
  const isEmail = emailSchema.safeParse(identifier).success;
  if (!isEmail && !/^[a-z0-9._-]{3,32}$/.test(identifier)) return responseError(res, 400, 'Usa un correo válido o un nickname de 3 a 32 caracteres.');
  if (role === 'provider' && (!providerProfile || customer)) return responseError(res, 400, 'El registro profesional requiere un perfil de servicio completo.');
  if (role === 'customer' && (!customer || providerProfile)) return responseError(res, 400, 'El registro de usuario requiere su fecha de nacimiento.');
  if (role === 'customer') {
    const date = new Date(`${customer.birthDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== customer.birthDate || date > new Date()) return responseError(res, 400, 'La fecha de nacimiento no es válida.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const existing = await client.query(
      'SELECT id, role, password_hash, email_verified_at FROM users WHERE lower(email) = $1 OR lower(username) = $1 FOR UPDATE',
      [identifier],
    );
    let userResult;
    if (existing.rowCount) {
      const legacyCustomer = role === 'customer' && isEmail && existing.rows[0].role === 'customer'
        && !existing.rows[0].password_hash && existing.rows[0].email_verified_at;
      if (!legacyCustomer) {
        await client.query('ROLLBACK');
        return responseError(res, 409, 'Ese correo o nickname ya está registrado.');
      }
      userResult = await client.query(
        `UPDATE users SET name = $1, password_hash = $2, birth_date = $3, phone = $4
         WHERE id = $5 RETURNING id, name, COALESCE(email, username) AS email, username, role`,
        [name, passwordHash, customer.birthDate, customer.phone, existing.rows[0].id],
      );
    } else {
      userResult = await client.query(
        `INSERT INTO users (name, email, username, password_hash, role, birth_date, phone, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id, name, COALESCE(email, username) AS email, username, role`,
        [name, isEmail ? identifier : null, isEmail ? null : identifier, passwordHash, role, customer?.birthDate ?? null, customer?.phone ?? providerProfile?.phone ?? null],
      );
    }
    const user = userResult.rows[0];
    if (role === 'provider' && !existing.rowCount) {
      await client.query(
        'INSERT INTO provider_profiles (user_id, category, province, profile_data) VALUES ($1, $2, $3, $4::jsonb)',
        [user.id, providerProfile.category, providerProfile.province, JSON.stringify(providerProfile)],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error?.code === '23505') return responseError(res, 409, 'Ese correo o nickname ya está registrado.');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', loginLimit, async (req, res, next) => {
  const parsed = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) return responseError(res, 400, 'Escribe tu correo o nickname y contraseña.');
  const identifier = parsed.data.identifier.toLowerCase();
  try {
    const result = await pool.query(
      `SELECT id, name, COALESCE(email, username) AS email, username, role, password_hash, email_verified_at
       FROM users WHERE lower(email) = $1 OR lower(username) = $1 LIMIT 1`,
      [identifier],
    );
    const user = result.rows[0];
    if (user && user.role === 'customer' && !user.password_hash && user.email_verified_at) {
      return responseError(res, 401, 'Completa nuevamente el registro para crear una contraseña para esta cuenta.');
    }
    if (!user || !user.password_hash || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return responseError(res, 401, 'Correo/nickname o contraseña incorrectos.');
    }
    res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } });
  } catch (error) {
    next(error);
  }
});
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.auth.sub, name: req.auth.name, email: req.auth.email, role: req.auth.role } });
});

app.post('/api/users/me/profile-photo', requireAuth, uploadLimit, upload.single('profilePhoto'), async (req, res, next) => {
  if (req.auth.role !== 'customer') return responseError(res, 403, 'Esta opción es solo para cuentas de usuario.');
  if (!req.file) return responseError(res, 400, 'Selecciona una foto de perfil.');
  const file = req.file;
  if (!file.mimetype.startsWith('image/')) return responseError(res, 415, 'La foto de perfil debe ser una imagen.');
  const extension = path.extname(file.originalname).toLowerCase().slice(0, 12) || '.jpg';
  const objectKey = `users/${req.auth.sub}/profile/${crypto.randomUUID()}${extension}`;
  const storedPath = resolveStoredFile(objectKey);
  try {
    await mkdir(path.dirname(storedPath), { recursive: true });
    await writeFile(storedPath, file.buffer, { flag: 'wx', mode: 0o600 });
    const result = await pool.query(
      `INSERT INTO provider_files (user_id, file_kind, object_key, original_name, content_type, byte_size)
       VALUES ($1, 'profile_photo', $2, $3, $4, $5) RETURNING id`,
      [req.auth.sub, objectKey, file.originalname.slice(0, 240), file.mimetype, file.size],
    );
    await pool.query('UPDATE users SET profile_photo_file_id = $1 WHERE id = $2', [result.rows[0].id, req.auth.sub]);
    const apiBase = (process.env.API_PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.status(201).json({ file: { id: result.rows[0].id, url: `${apiBase}/api/public/files/${result.rows[0].id}` } });
  } catch (error) {
    await unlink(storedPath).catch(() => {});
    next(error);
  }
});

app.post('/api/providers/me/files', requireAuth, requireProvider, uploadLimit, upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'portfolioPhotos', maxCount: 8 },
  { name: 'identityDocument', maxCount: 1 },
  { name: 'certificate', maxCount: 1 },
]), async (req, res, next) => {
  const files = req.files ?? {};
  const entries = Object.entries(files).flatMap(([field, values]) => (values ?? []).map((file) => ({
    field,
    file,
    kind: ({ profilePhoto: 'profile_photo', portfolioPhotos: 'portfolio_photo', identityDocument: 'identity_document', certificate: 'certificate' })[field],
  })));
  if (entries.length === 0) return res.json({ files: [] });

  const uploadedKeys = [];
  const replacedKeys = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved = [];
    for (const { field, file, kind } of entries) {
      if (field === 'profilePhoto') {
        const previous = await client.query(
          "DELETE FROM provider_files WHERE user_id = $1 AND file_kind = 'profile_photo' RETURNING object_key",
          [req.auth.sub],
        );
        replacedKeys.push(...previous.rows.map((row) => row.object_key));
      }
      const extension = path.extname(file.originalname).toLowerCase().slice(0, 12) || (file.mimetype === 'application/pdf' ? '.pdf' : '.img');
      const objectKey = `providers/${req.auth.sub}/${kind}/${crypto.randomUUID()}${extension}`;
      const encrypted = kind === 'identity_document' || kind === 'certificate';
      const payload = encrypted ? encryptPrivateFile(file.buffer) : file.buffer;
      const storedPath = resolveStoredFile(objectKey);
      await mkdir(path.dirname(storedPath), { recursive: true });
      await writeFile(storedPath, payload, { flag: 'wx', mode: 0o600 });
      uploadedKeys.push(objectKey);
      const inserted = await client.query(
        'INSERT INTO provider_files (user_id, file_kind, object_key, encrypted_at_rest, original_name, content_type, byte_size) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, file_kind, original_name',
        [req.auth.sub, kind, objectKey, encrypted, file.originalname.slice(0, 240), file.mimetype, file.size],
      );
      saved.push({ ...inserted.rows[0], field });
    }
    await client.query('COMMIT');
    await Promise.all(replacedKeys.map((key) => unlink(resolveStoredFile(key)).catch(() => {})));
    res.status(201).json({ files: saved });
  } catch (error) {
    await client.query('ROLLBACK');
    await Promise.all(uploadedKeys.map((key) => unlink(resolveStoredFile(key)).catch(() => {})));
    next(error);
  } finally {
    client.release();
  }
});

app.get('/api/providers/me/files', requireAuth, requireProvider, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, file_kind, original_name, content_type, byte_size, encrypted_at_rest, created_at FROM provider_files WHERE user_id = $1 ORDER BY created_at DESC', [req.auth.sub]);
    res.json({ files: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/providers/me', requireAuth, requireProvider, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, COALESCE(u.email, u.username) AS email, p.province, p.profile_data,
        COALESCE((SELECT json_agg(json_build_object('id', f.id, 'kind', f.file_kind) ORDER BY f.created_at DESC)
          FROM provider_files f WHERE f.user_id = u.id AND f.file_kind IN ('profile_photo', 'portfolio_photo')), '[]'::json) AS public_files
       FROM users u JOIN provider_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [req.auth.sub],
    );
    if (!result.rowCount) return responseError(res, 404, 'No encontramos tu perfil profesional.');
    res.json({ provider: serializeProvider(result.rows[0], req) });
  } catch (error) { next(error); }
});

app.put('/api/providers/me/profile', requireAuth, requireProvider, async (req, res, next) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), profile: providerProfileSchema }).safeParse(req.body);
  if (!parsed.success) return responseError(res, 400, parsed.error.issues[0]?.message ?? 'Revisa los datos enviados.');
  const { name, profile } = parsed.data;
  const profileData = Object.fromEntries(Object.entries(profile).filter(([key]) => !['identityDocument', 'certificate', 'profilePhoto', 'portfolioPhotos'].includes(key)));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET name = $1, phone = $2 WHERE id = $3', [name, profile.phone, req.auth.sub]);
    const updated = await client.query('UPDATE provider_profiles SET category = $1, province = $2, profile_data = $3::jsonb, updated_at = now() WHERE user_id = $4', [profile.category, profile.province, JSON.stringify(profileData), req.auth.sub]);
    if (!updated.rowCount) { await client.query('ROLLBACK'); return responseError(res, 404, 'No encontramos tu perfil profesional.'); }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
});

app.delete('/api/providers/me/files/:id', requireAuth, requireProvider, async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM provider_files WHERE id = $1 AND user_id = $2 AND file_kind IN ('profile_photo', 'portfolio_photo') RETURNING object_key",
      [req.params.id, req.auth.sub],
    );
    const file = result.rows[0];
    if (!file) return responseError(res, 404, 'La foto no existe o no pertenece a tu perfil.');
    await unlink(resolveStoredFile(file.object_key)).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    if (error?.code === '22P02') return responseError(res, 400, 'El identificador de la foto no es válido.');
    next(error);
  }
});

app.get('/api/providers/me/files/:id/download', requireAuth, requireProvider, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT object_key, original_name, content_type, encrypted_at_rest FROM provider_files WHERE id = $1 AND user_id = $2 AND file_kind IN ('identity_document', 'certificate')",
      [req.params.id, req.auth.sub],
    );
    const file = result.rows[0];
    if (!file) return responseError(res, 404, 'No encontramos ese documento.');
    const stored = await readFile(resolveStoredFile(file.object_key));
    const content = file.encrypted_at_rest ? decryptPrivateFile(stored) : stored;
    res.set('Content-Type', file.content_type);
    res.set('Content-Length', String(content.length));
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

app.get('/api/providers', async (req, res, next) => {
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, COALESCE(u.email, u.username) AS email, p.category, p.province, p.profile_data,
         COALESCE(json_agg(json_build_object('id', f.id, 'kind', f.file_kind) ORDER BY f.created_at DESC) FILTER (WHERE f.id IS NOT NULL AND f.file_kind IN ('profile_photo', 'portfolio_photo')), '[]'::json) AS public_files
         , COALESCE(r.rating, 0)::float AS rating, COALESCE(r.review_count, 0)::int AS review_count,
         COALESCE(r.reviews, '[]'::jsonb) AS reviews
       FROM users u JOIN provider_profiles p ON p.user_id = u.id
       LEFT JOIN provider_files f ON f.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT AVG(pr.rating) AS rating, COUNT(*) AS review_count,
           jsonb_agg(jsonb_build_object('id', pr.id, 'customerName', c.name, 'rating', pr.rating, 'comment', pr.comment, 'createdAt', pr.created_at) ORDER BY pr.created_at DESC) AS reviews
         FROM provider_reviews pr JOIN users c ON c.id = pr.customer_id WHERE pr.provider_id = u.id
       ) r ON true
       WHERE ($1 = '' OR lower(p.category) = lower($1) OR (lower($1) IN ('plomero', 'plomeros') AND lower(p.category) IN ('plomero', 'plomeros')))
       GROUP BY u.id, p.user_id, r.rating, r.review_count, r.reviews ORDER BY r.rating DESC NULLS LAST, u.created_at DESC LIMIT 100`,
      [category],
    );
    const entries = result.rows.map((row) => serializeProvider(row, req));
    res.json({ providers: entries });
  } catch (error) {
    next(error);
  }
});

app.get('/api/providers/:providerId/reviews', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.id, u.name AS "customerName", r.rating, r.comment, r.created_at AS "createdAt"
       FROM provider_reviews r JOIN users u ON u.id = r.customer_id
       WHERE r.provider_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [req.params.providerId],
    );
    res.json({ reviews: result.rows });
  } catch (error) {
    if (error?.code === '22P02') return responseError(res, 400, 'El identificador del profesional no es válido.');
    next(error);
  }
});

app.post('/api/providers/:providerId/reviews', requireAuth, async (req, res, next) => {
  if (req.auth.role !== 'customer') return responseError(res, 403, 'Solo los clientes pueden dejar reseñas.');
  const parsed = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!parsed.success) return responseError(res, 400, 'Escribe un comentario y selecciona una calificación de 1 a 5.');
  try {
    const result = await pool.query(
      `INSERT INTO provider_reviews (provider_id, customer_id, rating, comment)
       SELECT p.user_id, c.id, $3, $4 FROM provider_profiles p, users c
       WHERE p.user_id = $1 AND c.id = $2 AND c.role = 'customer'
       ON CONFLICT (provider_id, customer_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()
       RETURNING id, rating, comment, created_at AS "createdAt"`,
      [req.params.providerId, req.auth.sub, parsed.data.rating, parsed.data.comment],
    );
    if (!result.rowCount) return responseError(res, 404, 'No encontramos ese profesional.');
    res.status(201).json({ review: { ...result.rows[0], customerName: req.auth.name } });
  } catch (error) {
    if (error?.code === '22P02') return responseError(res, 400, 'El identificador del profesional no es válido.');
    next(error);
  }
});

app.get('/api/public/files/:id', async (req, res, next) => {
  try {
    const result = await pool.query("SELECT object_key, content_type FROM provider_files WHERE id = $1 AND file_kind IN ('profile_photo', 'portfolio_photo')", [req.params.id]);
    const file = result.rows[0];
    if (!file) return responseError(res, 404, 'No encontramos la imagen.');
    const image = await readFile(resolveStoredFile(file.object_key));
    res.set('Content-Type', file.content_type);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(image);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return responseError(res, error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'El archivo supera el límite permitido o no se pudo procesar.');
  if (error?.status === 415) return responseError(res, 415, error.message);
  if (error instanceof z.ZodError) return responseError(res, 400, 'Revisa los datos enviados.');
  console.error(error);
  const status = error?.code === '23505' ? 409 : 500;
  res.status(status).json({ error: status === 500 ? 'Ocurrió un error interno. Inténtalo de nuevo.' : 'El dato ya existe.' });
});

function encryptPrivateFile(input) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fileEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([Buffer.from('SXP1'), iv, cipher.getAuthTag(), encrypted]);
}

function resolveStoredFile(objectKey) {
  const resolved = path.resolve(storageRoot, objectKey);
  if (!resolved.startsWith(`${storageRoot}${path.sep}`)) throw new Error('Invalid stored file path.');
  return resolved;
}

function decryptPrivateFile(input) {
  if (input.subarray(0, 4).toString() !== 'SXP1') throw new Error('Stored document has an unsupported encrypted format.');
  const iv = input.subarray(4, 16);
  const authTag = input.subarray(16, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileEncryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(input.subarray(32)), decipher.final()]);
}

async function start() {
  const schema = await readFile(path.join(rootDir, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await mkdir(storageRoot, { recursive: true });
  app.listen(port, '0.0.0.0', () => console.log(`ServiXP API listening on port ${port}`));
}

start().catch((error) => {
  console.error('API startup failed:', error);
  process.exit(1);
});
