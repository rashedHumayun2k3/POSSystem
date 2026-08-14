'use client';

import { useRef, useState } from 'react';
import { resolveMediaUrl, uploadImage } from '@/lib/media';
import ImageLightbox from './ImageLightbox';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  uploadingLabel: string;
  errorLabel: string;
  removeLabel: string;
  capture?: 'user' | 'environment';
}

export default function ImageUploadField({ value, onChange, label, uploadingLabel, errorLabel, removeLabel, capture }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(false);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
      setError(true);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="mt-1">
        <button
          type="button"
          onClick={() => (value ? setViewerOpen(true) : inputRef.current?.click())}
          className="w-full h-48 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden active:bg-gray-200"
        >
          {value ? (
            <img src={resolveMediaUrl(value) ?? ''} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-indigo-600 font-medium disabled:opacity-60"
          >
            {uploading ? uploadingLabel : label}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm text-red-500"
            >
              {removeLabel}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{errorLabel}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value && (
        <ImageLightbox open={viewerOpen} onClose={() => setViewerOpen(false)} url={value} title={label} />
      )}
    </div>
  );
}
