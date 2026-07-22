import { getErrorMessage } from "@/lib/api";
import { useToastStore } from "@/store/toastStore";

// One-line replacement for the local `error` useState + inline red box pattern that used to be
// repeated across the app — call this from a mutation's onError (or a synchronous validation
// check) instead of setting local state and rendering a <p> somewhere in the form.
export function toastError(err: unknown, fallback: string) {
  useToastStore.getState().show(getErrorMessage(err, fallback), "error");
}
