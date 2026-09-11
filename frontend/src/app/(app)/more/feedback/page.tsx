"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMyFeedback, createFeedback } from "@/lib/feedbackApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import { useToastStore } from "@/store/toastStore";
import ImageUploadField from "@/components/ui/ImageUploadField";
import { resolveMediaUrl } from "@/lib/media";

export default function FeedbackPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-feedback"],
    queryFn: listMyFeedback,
  });

  const createMutation = useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-feedback"] });
      setShowNew(false);
      setSubject("");
      setDetails("");
      setImageUrl(null);
      useToastStore.getState().show(t("feedback.submitted"));
    },
    onError: (err: unknown) => toastError(err, t("feedback.failed")),
  });

  function handleSubmit() {
    if (!subject.trim()) { useToastStore.getState().show(t("feedback.subjectRequired"), "error"); return; }
    if (!details.trim()) { useToastStore.getState().show(t("feedback.detailsRequired"), "error"); return; }
    createMutation.mutate({ subject: subject.trim(), details: details.trim(), imageUrl });
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t("more.feedback")}</h1>
        <button onClick={() => setShowNew((v) => !v)} className="text-sm font-semibold text-indigo-600">
          {showNew ? t("common.cancel") : t("feedback.new")}
        </button>
      </div>

      {showNew && (
        <div className="mx-4 mt-3 bg-indigo-50 rounded-xl p-4 space-y-3">
          <input
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t("feedback.subjectPlaceholder")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            rows={4}
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
            placeholder={t("feedback.detailsPlaceholder")}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <ImageUploadField
            value={imageUrl}
            onChange={setImageUrl}
            label={t("feedback.imageLabel")}
            uploadingLabel={t("feedback.imageUploading")}
            errorLabel={t("feedback.imageUploadFailed")}
            removeLabel={t("feedback.imageRemove")}
          />
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {createMutation.isPending ? t("feedback.submitting") : t("feedback.submit")}
          </button>
        </div>
      )}

      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t("feedback.empty")}</p>
        ) : (
          items.map((f) => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-xl p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{f.subject}</p>
                <span
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    f.reply ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${f.reply ? "bg-blue-500" : "bg-red-500"}`} />
                  {f.reply ? t("feedback.answered") : t("feedback.unanswered")}
                </span>
              </div>
              <p className="text-xs text-gray-500">{f.details}</p>
              {f.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(f.imageUrl) ?? ""} alt="" className="w-20 h-20 rounded-lg object-cover" />
              )}
              {f.reply && (
                <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">{t("feedback.replyLabel")}</p>
                  <p className="text-xs text-blue-900 mt-0.5">{f.reply.body}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
