"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveMediaUrl } from "@/lib/media";

export default function CategoryAvatar({
  name,
  imageUrl,
  colorClass,
  className,
}: {
  name: string;
  imageUrl?: string;
  colorClass: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(imageUrl);

  if (resolved && !failed) {
    return (
      <div className={`relative rounded-lg overflow-hidden bg-gray-100 ${className}`}>
        <Image src={resolved} alt={name} fill className="object-cover" unoptimized onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className={`rounded-lg flex items-center justify-center font-bold ${colorClass} ${className}`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}
