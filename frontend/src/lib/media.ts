import axios from 'axios';

const IMAGE_QUALITY = 0.76;
const MAX_DIMENSION = 1600;

// Upload/download of files is handled by the standalone ResellerApi.MediaService app, not the
// main API — see docs/... (image upload architecture decision). Separate axios instance since
// it talks to a different origin than `api` (frontend/src/lib/api.ts).
const mediaApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_MEDIA_URL });

mediaApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    const businessId = localStorage.getItem('businessId');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (businessId) config.headers['X-Business-Id'] = businessId;
  }
  return config;
});

// Backend returns storage-relative paths (e.g. "/uploads/{businessId}/{file}.jpg").
// Resolve them against the media service's origin so <img> tags work regardless of the
// frontend's own origin/port.
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = process.env.NEXT_PUBLIC_MEDIA_URL ?? '';
  return `${origin}${url}`;
}

// Re-encode at the source pixel dimensions to reduce transfer/storage bytes
// without reducing image resolution.
function compressImage(file: File, preserveResolution = false, maxWidth?: number): Promise<{ blob: Blob; extension: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const scale = maxWidth
        ? Math.min(1, maxWidth / img.width)
        : preserveResolution ? 1 : Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // WebP usually gives product photos a smaller file than JPEG at similar
      // visual quality. Fall back to JPEG where WebP encoding is unavailable.
      canvas.toBlob((webp) => {
        if (!webp) { reject(new Error('Image compression failed')); return; }
        if (webp.type === 'image/webp') {
          resolve(maxWidth || webp.size < file.size
            ? { blob: webp, extension: '.webp' }
            : { blob: file, extension: file.name.match(/\.[^.]+$/)?.[0] ?? '.jpg' });
          return;
        }
        canvas.toBlob((jpeg) => {
          if (!jpeg) { reject(new Error('Image compression failed')); return; }
          resolve(maxWidth || jpeg.size < file.size
            ? { blob: jpeg, extension: '.jpg' }
            : { blob: file, extension: file.name.match(/\.[^.]+$/)?.[0] ?? '.jpg' });
        }, 'image/jpeg', IMAGE_QUALITY);
      }, 'image/webp', IMAGE_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image file')); };
    img.src = objectUrl;
  });
}

export async function uploadImage(file: File, options: { preserveResolution?: boolean; maxWidth?: number } = {}): Promise<string> {
  const { blob, extension } = await compressImage(file, options.preserveResolution, options.maxWidth);
  const formData = new FormData();
  formData.append('file', blob, file.name.replace(/\.[^.]+$/, extension));

  const { data } = await mediaApi.post<{ url: string }>('/api/v1/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

export async function uploadFile(file: File): Promise<string> {
  if (file.type.startsWith('image/')) return uploadImage(file);
  if (file.type !== 'application/pdf') throw new Error('Only images and PDF files are allowed.');
  if (file.size > 5 * 1024 * 1024) throw new Error('File must be 5MB or smaller.');

  const formData = new FormData();
  formData.append('file', file);
  const { data } = await mediaApi.post<{ url: string }>('/api/v1/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
