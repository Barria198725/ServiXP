import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';

export type UserRole = 'customer' | 'provider';
export type LocalUser = { id?: string; name: string; email: string; username?: string; role: UserRole };
export type ProviderProfile = {
  phone: string;
  category: string;
  specialties: string;
  description: string;
  province?: string;
  coverage: string;
  days: string;
  hours: string;
  emergency: boolean;
  experience: string;
  identityDocument: string;
  certificate: string;
  profilePhoto: string;
  portfolioPhotos: string[];
  rateType: string;
  rate: string;
  paymentMethods: string;
  liabilityInsurance?: boolean;
};

export type ProviderReview = { id: string; customerName: string; rating: number; comment: string; createdAt: string };
export type ProviderDirectoryEntry = { id?: string; name: string; email: string; rating?: number; reviewCount?: number; verified?: boolean; reviews?: ProviderReview[]; profile: ProviderProfile };
export type CustomerRegistration = { birthDate: string; phone?: string };

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const isLocalApiUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(configuredApiUrl);
const packagerHost = Constants.expoConfig?.hostUri?.replace(/:\d+$/, '');
const API_URL = (isLocalApiUrl && Platform.OS !== 'web' && packagerHost && !/^(localhost|127\.0\.0\.1)$/i.test(packagerHost)
  ? `http://${packagerHost}:4000`
  : isLocalApiUrl && Platform.OS === 'android'
    ? 'http://10.0.2.2:4000'
    : configuredApiUrl).replace(/\/$/, '');
const TOKEN_KEY = 'servixp-auth-token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    });
    const body = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new ApiError(body.error ?? 'Ocurrió un error al comunicarse con el servidor.', response.status);
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('El servidor tardó demasiado en responder. Revisa tu conexión e inténtalo nuevamente.', 408);
    }
    throw new ApiError(`No se pudo conectar con ServiXP API (${API_URL}). Revisa que Docker esté iniciado y que la dirección sea accesible desde el dispositivo.`, 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function getToken() {
  if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function signOut() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function createAccount(name: string, identifier: string, password: string, role: UserRole, providerProfile?: ProviderProfile, customer?: CustomerRegistration): Promise<LocalUser> {
  const profile = providerProfile
    ? Object.fromEntries(Object.entries(providerProfile).filter(([key]) => !['identityDocument', 'certificate', 'profilePhoto', 'portfolioPhotos'].includes(key)))
    : undefined;
  const result = await request<{ token: string; user: LocalUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), identifier: identifier.trim(), password, role, ...(profile ? { providerProfile: profile } : {}), ...(customer ? { customer } : {}) }),
  });
  await saveToken(result.token);
  return result.user;
}

export async function signIn(identifier: string, password: string): Promise<LocalUser> {
  const result = await request<{ token: string; user: LocalUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  await saveToken(result.token);
  return result.user;
}

export async function uploadProviderFiles(profile: ProviderProfile) {
  const token = await getToken();
  if (!token) throw new ApiError('La sesión expiró. Vuelve a iniciar sesión para subir tus archivos.', 401);
  const body = new FormData();
  const append = async (field: string, uri: string, fallbackName: string) => {
    if (!uri) return;
    let uploadUri = uri;
    let name = decodeURIComponent(uri.split(/[\\/]/).pop()?.split('?')[0] || fallbackName);
    let extension = name.split('.').pop()?.toLowerCase();
    let type = extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    if (field === 'profilePhoto' || field === 'portfolioPhotos') {
      const rendered = await ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
      const normalized = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.82 });
      uploadUri = normalized.uri;
      name = `${field === 'profilePhoto' ? 'foto-perfil' : 'trabajo'}.jpg`;
      type = 'image/jpeg';
    }
    if (Platform.OS === 'web') {
      const fileResponse = await fetch(uploadUri);
      const file = await fileResponse.blob();
      body.append(field, file, name);
    } else {
      body.append(field, { uri: uploadUri, name, type } as unknown as Blob);
    }
  };

  await append('profilePhoto', profile.profilePhoto, 'foto-perfil.jpg');
  await append('identityDocument', profile.identityDocument, 'documento-identidad');
  await append('certificate', profile.certificate, 'certificado');
  for (const [index, uri] of profile.portfolioPhotos.entries()) await append('portfolioPhotos', uri, `trabajo-${index + 1}.jpg`);
  const selectedFiles = [profile.profilePhoto, profile.identityDocument, profile.certificate, ...profile.portfolioPhotos];
  if (!selectedFiles.some(Boolean)) return;

  await request<{ files: unknown[] }>('/api/providers/me/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

export async function uploadCustomerProfilePhoto(uri: string) {
  const token = await getToken();
  if (!token) throw new ApiError('La sesión expiró. Inicia sesión para guardar tu foto.', 401);
  const body = new FormData();
  const name = decodeURIComponent(uri.split(/[\\/]/).pop()?.split('?')[0] || 'foto-perfil.jpg');
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    body.append('profilePhoto', await response.blob(), name);
  } else {
    body.append('profilePhoto', { uri, name, type: 'image/jpeg' } as unknown as Blob);
  }
  await request<{ file: unknown }>('/api/users/me/profile-photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
}

export async function getProvidersByCategory(category = ''): Promise<ProviderDirectoryEntry[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const result = await request<{ providers: ProviderDirectoryEntry[] }>(`/api/providers${query}`);
  return result.providers.map(withReachablePhotoUrls);
}

export async function getMyProviderProfile(): Promise<ProviderDirectoryEntry> {
  const token = await getToken();
  if (!token) throw new ApiError('Inicia sesión como profesional para editar tu perfil.', 401);
  const result = await request<{ provider: ProviderDirectoryEntry }>('/api/providers/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return withReachablePhotoUrls(result.provider);
}

export async function updateMyProviderProfile(name: string, profile: ProviderProfile): Promise<void> {
  const token = await getToken();
  if (!token) throw new ApiError('Inicia sesión como profesional para editar tu perfil.', 401);
  await request<{ ok: boolean }>('/api/providers/me/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: name.trim(), profile }),
  });
}

export async function removeMyProviderPhoto(photoUrl: string): Promise<void> {
  const token = await getToken();
  if (!token) throw new ApiError('Inicia sesión como profesional para quitar fotos.', 401);
  const id = new URL(photoUrl, API_URL).pathname.split('/').pop();
  if (!id) throw new ApiError('No se pudo identificar la foto seleccionada.', 400);
  await request<{ ok: boolean }>(`/api/providers/me/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function withReachablePhotoUrls(provider: ProviderDirectoryEntry): ProviderDirectoryEntry {
  const resolve = (value: string) => {
    if (!value) return value;
    try {
      const url = new URL(value, API_URL);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        const api = new URL(API_URL);
        url.protocol = api.protocol;
        url.host = api.host;
      }
      return url.toString();
    } catch {
      return value;
    }
  };
  return {
    ...provider,
    profile: {
      ...provider.profile,
      profilePhoto: resolve(provider.profile.profilePhoto),
      portfolioPhotos: (provider.profile.portfolioPhotos ?? []).map(resolve),
    },
  };
}

export async function getProviderReviews(providerId: string): Promise<ProviderReview[]> {
  const result = await request<{ reviews: ProviderReview[] }>(`/api/providers/${encodeURIComponent(providerId)}/reviews`);
  return result.reviews;
}

export async function createProviderReview(providerId: string, rating: number, comment: string): Promise<ProviderReview> {
  const token = await getToken();
  if (!token) throw new ApiError('Inicia sesión para dejar una reseña.', 401);
  const result = await request<{ review: ProviderReview }>(`/api/providers/${encodeURIComponent(providerId)}/reviews`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ rating, comment }),
  });
  return result.review;
}
