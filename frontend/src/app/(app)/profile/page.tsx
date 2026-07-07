"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { uploadImage } from "@/lib/media";
import { updateMyPhoto } from "@/lib/usersApi";
import Avatar from "@/components/ui/Avatar";
import { useLanguage } from "@/i18n/LanguageContext";

const ROLE_KEY: Record<string, string> = {
  OWNER: "settings.roleOwner",
  MANAGER: "settings.roleManager",
  STAFF: "settings.roleStaff",
  WAREHOUSE: "settings.roleWarehouse",
};

export default function ProfilePage() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const updateUserPhoto = useAuthStore((s) => s.updateUserPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const url = await uploadImage(file);
      await updateMyPhoto(url);
      updateUserPhoto(url);
    } catch {
      setError(t("profile.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative"
        >
          <Avatar name={user.name} photoUrl={user.photoUrl} size={96} />
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-semibold text-indigo-600 disabled:opacity-50"
        >
          {uploading ? t("profile.uploading") : t("profile.changePhoto")}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.name")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{user.name}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.phone")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{user.phone}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t("profile.role")}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{t(ROLE_KEY[user.role] ?? "settings.roleStaff")}</p>
        </div>
      </div>
    </div>
  );
}
