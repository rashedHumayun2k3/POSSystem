const BENEFITS = [
  { icon: "$", title: "Payment & Delivery", description: "Delivered when your order arrives" },
  { icon: "↩", title: "Return Product", description: "Simple product return process" },
  { icon: "calendar", title: "30 Days Guarantee", description: "30-day free return policy" },
  { icon: "headphones", title: "Quality Support", description: "Support options including 24/7" },
];

export default function TossCollectionBenefits() {
  return (
    <section className="bg-[#fbefef] px-5 py-12 sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto grid w-full max-w-[1700px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <article key={benefit.title} className="flex min-h-[220px] flex-col rounded-[24px] bg-white px-6 py-8 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:px-8 sm:py-10">
            <div className="flex flex-1 items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center text-5xl font-semibold text-[#f4511e] sm:h-18 sm:w-18 sm:text-[3.25rem]">
              {benefit.icon === "calendar" ? (
                <svg className="text-[#f4511e]" width="60" height="60" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                  <rect x="8" y="11" width="36" height="33" rx="5" stroke="currentColor" strokeWidth="3.5" />
                  <path d="M8 20h36M17 8v7M35 8v7M17 27h.01M26 27h.01M35 27h.01M17 35h.01M26 35h.01" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              ) : benefit.icon === "headphones" ? (
                <svg className="text-[#f4511e]" width="60" height="60" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                  <path d="M10 29v-3a16 16 0 0 1 32 0v3" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M10 28h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1a5 5 0 0 1-5-5v-5a3 3 0 0 1 3-3ZM42 28h-3a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1a5 5 0 0 0 5-5v-5a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
                  <path d="M36 41c-1 3-4 4-8 4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              ) : benefit.icon}
              </div>
            </div>
            <h3 className="text-xl font-normal leading-tight text-[#24282c]">{benefit.title}</h3>
            <p className="mt-3 text-sm text-gray-500">{benefit.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
