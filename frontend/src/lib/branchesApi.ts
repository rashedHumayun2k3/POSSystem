import { api } from "./api";
import type { Branch } from "@/types/branch";

export const listBranches = async (): Promise<Branch[]> => {
  const { data } = await api.get("/branches");
  return data;
};

export const listMyBranches = async (): Promise<Branch[]> => {
  const { data } = await api.get("/branches/mine");
  return data;
};

export const createBranch = async (payload: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}): Promise<Branch> => {
  const { data } = await api.post("/branches", payload);
  return data;
};

export const updateBranch = async (
  id: string,
  payload: { name: string; code: string; address?: string; phone?: string }
): Promise<void> => {
  await api.patch(`/branches/${id}`, payload);
};

export const toggleBranchActive = async (id: string): Promise<{ isActive: boolean }> => {
  const { data } = await api.patch(`/branches/${id}/toggle-active`);
  return data;
};
