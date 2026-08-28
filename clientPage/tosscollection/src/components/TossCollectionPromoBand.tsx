"use client";

export default function TossCollectionPromoBand() {
  return (
    <section className="bg-[var(--toss-teal)] px-4 py-7 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col justify-between gap-2 pb-5 text-[11px] text-white/75 sm:flex-row">
          <span>*Terms & conditions applied. Available until stocks last.</span>
          <span>Offer available only on TOSS Collection official website.</span>
        </div>
        <div className="flex flex-wrap justify-center gap-5 sm:gap-10 lg:gap-14">
          <Ribbon buy="2" get="1" />
          <Ribbon buy="3" get="2" />
          <Ribbon buy="4" get="3" />
        </div>
      </div>
    </section>
  );
}

function Ribbon({ buy, get }: { buy: string; get: string }) {
  return (
    <div className="flex h-28 w-24 flex-col items-center justify-center bg-[var(--toss-maroon)] text-white [clip-path:polygon(0_0,100%_0,100%_76%,50%_100%,0_76%)]">
      <span className="text-xs font-bold uppercase tracking-[0.18em]">Buy</span>
      <span className="toss-display text-4xl leading-none">{buy}</span>
      <span className="text-xs font-bold uppercase tracking-[0.14em]">Get {get}</span>
    </div>
  );
}
