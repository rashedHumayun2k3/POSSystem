"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getReviews, submitReview, uploadReviewImage, getErrorMessage } from "@/lib/clientPageApi";
import { useClientPageAuthStore } from "@/store/clientPageAuthStore";
import GoogleSignInButton from "./GoogleSignInButton";
import FacebookSignInButton from "./FacebookSignInButton";
import { resolveMediaUrl } from "@/lib/media";

function Stars({ rating, size = "text-base" }: { rating: number; size?: string }) {
  return (
    <span className={`text-amber-400 ${size}`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-gray-200">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

function WriteReviewForm({ productId, prefillPhone, onDone }: { productId: string; prefillPhone?: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState(prefillPhone ?? "");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => submitReview(productId, { rating, body: body.trim(), phone: phone.trim(), imageUrls: images }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientpage-reviews", productId] });
      onDone();
    },
    onError: (err) => setError(getErrorMessage(err, "Could not submit your review. Please try again.")),
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - images.length);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls = await Promise.all(files.map((f) => uploadReviewImage(productId, f)));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(getErrorMessage(err, "Could not upload image."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-3">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Rating</p>
        <div className="flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} className={n <= rating ? "text-amber-400" : "text-gray-200"}>
              ★
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience with this product…"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
      />

      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone number used for this order</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
        />
        <p className="text-[11px] text-gray-400 mt-1">We use this to confirm you bought this product.</p>
      </div>

      <div>
        <div className="flex gap-2 flex-wrap">
          {images.map((url) => (
            <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <Image src={resolveMediaUrl(url) ?? ''} alt="" fill className="object-cover" unoptimized />
            </div>
          ))}
          {images.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-16 h-16 rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs flex items-center justify-center"
            >
              {uploading ? "…" : "+ Photo"}
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleFiles} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !body.trim() || !phone.trim()}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50"
        >
          {mutation.isPending ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </div>
  );
}

export default function ProductReviews({ productId, prefillPhone }: { productId: string; prefillPhone?: string }) {
  const { token, name, photoUrl, logout } = useClientPageAuthStore();
  const [showForm, setShowForm] = useState(!!prefillPhone);
  const [loginError, setLoginError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clientpage-reviews", productId],
    queryFn: () => getReviews(productId),
  });

  return (
    <div className="px-4 lg:px-8 py-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base lg:text-lg font-semibold text-gray-900">Reviews</h2>
        {data && data.summary.count > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Stars rating={data.summary.averageRating} />
            <span>{data.summary.averageRating.toFixed(1)}</span>
            <span className="text-gray-400">({data.summary.count})</span>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading reviews…</p>}

      {!isLoading && data && data.reviews.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 mb-3">No reviews yet — be the first to review this product.</p>
      )}

      <div className="space-y-4 mb-4">
        {data?.reviews.map((r) => (
          <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0">
            <div className="flex items-center gap-2 mb-1">
              {r.reviewerPhotoUrl ? (
                <Image src={resolveMediaUrl(r.reviewerPhotoUrl) ?? ''} alt={r.reviewerName} width={24} height={24} className="rounded-full" unoptimized />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                  {r.reviewerName[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-gray-800">{r.reviewerName}</span>
              <Stars rating={r.rating} size="text-xs" />
            </div>
            <p className="text-sm text-gray-700">{r.body}</p>
            {r.images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {r.images.map((img) => (
                  <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={resolveMediaUrl(img.imageUrl) ?? ''} alt="" fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            )}
            {r.reply && (
              <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-gray-500">Shop reply</p>
                <p className="text-sm text-gray-600 mt-0.5">{r.reply.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && token ? (
        <WriteReviewForm productId={productId} prefillPhone={prefillPhone} onDone={() => setShowForm(false)} />
      ) : token ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {photoUrl && <Image src={resolveMediaUrl(photoUrl) ?? ''} alt={name ?? ""} width={20} height={20} className="rounded-full" unoptimized />}
            <span>Signed in as {name}</span>
            <button onClick={logout} className="text-xs text-gray-400 underline">
              sign out
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white shrink-0"
          >
            Write a review
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-2">Sign in to write a review.</p>
          <div className="flex flex-col gap-2">
            <GoogleSignInButton onError={setLoginError} />
            <FacebookSignInButton onError={setLoginError} />
          </div>
          {loginError && <p className="text-xs text-red-600 mt-2">{loginError}</p>}
        </div>
      )}
    </div>
  );
}
