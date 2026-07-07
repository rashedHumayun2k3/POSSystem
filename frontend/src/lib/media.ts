import { api } from './api';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

// Backend returns storage-relative paths (e.g. "/uploads/{businessId}/{file}.jpg").
// Resolve them against the API origin so <img> tags work regardless of the
// frontend's own origin/port.
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const origin = apiUrl.replace(/\/api\/v1\/?$/, '');
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

  const { data } = await api.post<{ url: string }>('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
