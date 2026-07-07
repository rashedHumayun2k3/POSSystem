import { api } from "./api";

export const updateMyPhoto = async (photoUrl: string | null): Promise<{ photoUrl: string | null }> => {
  const { data } = await api.patch("/users/me/photo", { photoUrl });
  return data;
};
