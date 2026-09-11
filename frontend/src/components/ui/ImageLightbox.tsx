'use client';

import SlidePanel from './SlidePanel';
import { resolveMediaUrl } from '@/lib/media';

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  alt?: string;
  title?: string;
}

export default function ImageLightbox({ open, onClose, url, alt, title }: Props) {
  return (
    <SlidePanel open={open} onClose={onClose} title={title ?? ''}>
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <img
          src={resolveMediaUrl(url) ?? ''}
          alt={alt ?? ''}
          className="max-w-full max-h-[70vh] object-contain rounded-lg"
        />
      </div>
    </SlidePanel>
  );
}
