import { resolveMediaUrl } from "@/lib/media";

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-orange-500",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorOf(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, photoUrl, size = 32, className = "" }: AvatarProps) {
  const resolved = resolveMediaUrl(photoUrl);
  const style = { width: size, height: size };

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        style={style}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${colorOf(name)} ${className}`}
    >
      <span style={{ fontSize: Math.max(10, size * 0.4) }}>{initialsOf(name)}</span>
    </div>
  );
}
