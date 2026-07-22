"use client";

import { useState } from "react";
import Link from "next/link";
import TopHeader from "@/components/TopHeader";
import {
  requestSignupCode,
  verifySignupCode,
  completeSignup,
  getErrorMessage,
} from "@/lib/sellerAuthApi";

const COUNTRIES = ["Bangladesh", "India", "Pakistan", "Nepal", "Sri Lanka", "Myanmar", "Other"];
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

const inputClass =
  "rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400";

type Step = "email" | "code" | "details" | "done";

export default function SellerSignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultName, setResultName] = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await requestSignupCode(email.trim());
      setStep("code");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the verification code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      await verifySignupCode(email.trim(), code.trim());
      setStep("details");
    } catch (err) {
      setError(getErrorMessage(err, "That code didn't match. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || password.length < 8 || !businessName.trim()) {
      setError("Please fill in all fields — password must be at least 8 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await completeSignup({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
        password,
        businessName: businessName.trim(),
        country,
      });
      setResultName(result.user.name);
      setStep("done");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create your account. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <TopHeader />
      <div className="lg:max-w-md lg:mx-auto px-4 lg:px-0 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Become a Seller</h1>
        <p className="text-sm text-gray-500 mb-6">
          Set up your own shop and start listing products on the marketplace.
        </p>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className={inputClass}
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Sending code…" : "Send verification code"}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Already have a seller account?{" "}
              <Link href="/seller/login" className="text-indigo-600">
                Log in
              </Link>
            </p>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Enter the 6-digit code we sent to <span className="font-medium">{email}</span>.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className={`${inputClass} tracking-widest text-center text-lg`}
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify code"}
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputClass} autoFocus />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" className={inputClass} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className={inputClass}
            />
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business / shop name"
              className={inputClass}
            />
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Creating your account…" : "Create seller account"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-3 items-start">
            <p className="text-sm text-gray-700">
              Welcome, <span className="font-medium">{resultName}</span> — your seller account is ready.
            </p>
            <p className="text-sm text-gray-500">
              Log in to your dashboard to add products and start selling.
            </p>
            <a
              href={`${FRONTEND_URL}/login`}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 px-6 hover:bg-indigo-700"
            >
              Go to my dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
