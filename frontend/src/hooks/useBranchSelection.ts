"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { listMyBranches } from "@/lib/branchesApi";

// Fetches the current user's assigned branches and either auto-selects the sole branch,
// or routes to the branch picker (or a blocking error if none are assigned). Used right
// after login and whenever the active business is switched.
export function useBranchSelection() {
  const { setBranches, switchBranch } = useAuthStore();
  const router = useRouter();

  return async function resolveBranch() {
    const branches = await listMyBranches();
    setBranches(branches);

    if (branches.length === 1) {
      switchBranch(branches[0].id);
      router.replace("/dashboard");
    } else if (branches.length === 0) {
      router.replace("/select-branch?error=none");
    } else {
      router.replace("/select-branch");
    }
  };
}
