import Image from "next/image";

const FEATURES = [
  "Track inventory & stock in real time",
  "Manage Facebook & courier COD orders",
  "Scan barcodes and sell from the shop counter",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-indigo-100">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="text-sm">{text}</span>
    </li>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gradient-to-b from-indigo-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Mobile-only soft background accents — no split panel on small screens, just a hint of brand color */}
      <div className="lg:hidden pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl" />
      <div className="lg:hidden pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />

      {/* Desktop branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-indigo-950">
        <Image
          src="/auth-hero.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        {/* Dark gradient overlay so white text/badge stay readable over any photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-indigo-950/75 to-slate-950/90" />
        <div className="pointer-events-none absolute -top-32 -left-20 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-md px-12 text-center">
          <Image
            src="/lavlokshan-badge-midnight.svg"
            alt="LavLokshan"
            width={140}
            height={146}
            className="mx-auto mb-8 drop-shadow-2xl"
            priority
          />
          <h1 className="text-4xl font-bold text-white mb-3">LavLokshan</h1>
          <p className="text-indigo-200 text-lg mb-10">Run your reselling business from your pocket</p>
          <ul className="space-y-4 text-left inline-flex flex-col">
            {FEATURES.map((text) => (
              <FeatureItem key={text} text={text} />
            ))}
          </ul>
        </div>
      </div>

      {/* Form column */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 relative z-10">
        {children}
      </div>
    </div>
  );
}
