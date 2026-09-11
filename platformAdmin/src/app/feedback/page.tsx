"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { getFeedback, replyToFeedback } from "@/lib/platformAdminApi";
import { getErrorMessage } from "@/lib/api";
import type { AdminFeedback } from "@/lib/types";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function resolveMediaUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${process.env.NEXT_PUBLIC_MEDIA_URL ?? ""}${url}`;
}

function ReplyModal({ feedback, onClose }: { feedback: AdminFeedback; onClose: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => replyToFeedback(feedback.id, body.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      onClose();
    },
    onError: (err: unknown) => setError(getErrorMessage(err, "Could not send reply.")),
  });

  const imageUrl = resolveMediaUrl(feedback.imageUrl);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{feedback.subject}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {feedback.businessName} · {feedback.submittedByName} · {fmtDate(feedback.createdAt)}
          </p>
        </div>

        <p className="text-sm text-gray-700 whitespace-pre-line">{feedback.details}</p>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full max-h-64 object-contain rounded-xl border border-gray-100" />
        )}

        {feedback.reply ? (
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">
              Reply — {feedback.reply.repliedByUsername} · {fmtDate(feedback.reply.createdAt)}
            </p>
            <p className="text-sm text-blue-900 mt-1 whitespace-pre-line">{feedback.reply.body}</p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your reply</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              placeholder="Write a reply…"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700"
          >
            Close
          </button>
          {!feedback.reply && (
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !body.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-60"
            >
              {mutation.isPending ? "Sending…" : "Send Reply"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const { token, hasHydrated, logout } = useAdminAuthStore();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminFeedback | null>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feedback", search],
    queryFn: () => getFeedback(search || undefined),
    enabled: !!token,
  });

  if (!hasHydrated || !token) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700">
            ← Dashboard
          </Link>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by subject or business…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Submitted By</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No feedback found.</td>
              </tr>
            )}
            {items.map((f) => (
              <tr key={f.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 text-gray-700">{f.businessName}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{f.subject}</td>
                <td className="px-4 py-3 text-gray-500">{f.submittedByName}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(f.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`flex items-center gap-1.5 w-fit text-xs font-medium px-2 py-1 rounded-full ${
                      f.reply ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${f.reply ? "bg-blue-500" : "bg-red-500"}`} />
                    {f.reply ? "Answered" : "Unanswered"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setTarget(f)}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    {f.reply ? "View" : "Reply"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && <ReplyModal feedback={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
