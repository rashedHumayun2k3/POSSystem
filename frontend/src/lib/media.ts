import axios from 'axios';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

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

// Downscales + re-encodes an image client-side before upload (R2.3 stack note:
// "Client-side image compression before upload") so large phone-camera photos
// don't get pushed to the server as-is.
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image file')); };
    img.src = objectUrl;
  });
}

export async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append('file', compressed, file.name.replace(/\.[^.]+$/, '.jpg'));

  const { data } = await mediaApi.post<{ url: string }>('/api/v1/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
