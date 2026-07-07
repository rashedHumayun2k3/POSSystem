"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";

export default function SelectBranchPage() {
  const { branches, switchBranch } = useAuthStore();
  const router = useRouter();
  const logout = useLogout();
  const searchParams = useSearchParams();
  const noBranchesAssigned = searchParams.get("error") === "none";

  const handleSelect = (branchId: string) => {
    switchBranch(branchId);
    router.replace("/dashboard");
  };

  if (noBranchesAssigned) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900">No branch assigned</h1>
          <p className="text-sm text-gray-500">
            Your account isn&apos;t assigned to any branch yet. Contact your business owner to
            get access.
          </p>
          <button
            onClick={() => logout()}
            className="w-full h-12 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 active:scale-[0.98] transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Select a branch</h1>
        <p className="text-sm text-gray-500 mt-1">Choose which branch you&apos;re working at</p>
      </div>

      <div className="space-y-3">
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => handleSelect(b.id)}
            className="w-full flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-4 h-16 active:scale-[0.98] transition"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">{b.name}</p>
              <p className="text-xs text-gray-400">{b.code}</p>
            </div>
            {b.isDefault && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                Default
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
