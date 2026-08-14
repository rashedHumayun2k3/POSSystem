import type { TripStatus } from '@/types/purchases';

type Translate = (key: string) => string;

type PurchaseStep = {
  status: Exclude<TripStatus, 'CANCELLED'>;
  labelKey: string;
};

const STEPS: PurchaseStep[] = [
  { status: 'DRAFT', labelKey: 'purchases.stepDraft' },
  { status: 'PENDING_APPROVAL', labelKey: 'purchases.stepPendingApproval' },
  { status: 'RECEIVING', labelKey: 'purchases.stepReceiving' },
  { status: 'COMPLETED', labelKey: 'purchases.stepCompleted' },
];

const STEP_INDEX: Record<PurchaseStep['status'], number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  RECEIVING: 2,
  COMPLETED: 3,
};

export function PurchaseProgress({ status, t }: { status: TripStatus; t: Translate }) {
  if (status === 'CANCELLED') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-[9px] font-medium leading-tight text-red-700">
          {t('purchases.stepCancelled')}
        </span>
      </div>
    );
  }

  const currentIndex = STEP_INDEX[status] ?? 0;

  return (
    <div className="mt-1.5 flex items-start">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReached = index <= currentIndex;
        const shouldShowLabel = isCurrent || index === currentIndex + 1;

        return (
          <div key={step.status} className="contents">
            <div
              className={`flex w-[44px] shrink-0 flex-col items-center rounded-md px-0.5 py-0.5 ${
                isCurrent ? 'bg-orange-50' : ''
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  isReached
                    ? 'bg-orange-400'
                    : 'bg-white border border-orange-200'
                }`}
              />
              {shouldShowLabel && (
                <span
                  className={`mt-0.5 min-h-[18px] text-center text-[8px] leading-[9px] ${
                    isReached ? 'font-medium text-gray-800' : 'text-orange-300'
                  }`}
                >
                  {t(step.labelKey)}
                </span>
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mt-[9px] h-px min-w-[4px] flex-1 ${
                  isDone ? 'bg-orange-400' : 'bg-orange-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PurchaseProcessGuide({ activeStep = 'DRAFT', t }: { activeStep?: TripStatus; t: Translate }) {
  if (activeStep === 'CANCELLED') {
    return (
      <div className="bg-red-50 rounded-xl border border-red-100 px-3 py-4">
        <p className="text-[11px] font-semibold text-red-700 mb-3">
          {t('purchases.currentStatusFlow')}
        </p>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-[11px] font-medium text-red-700">
            {t('purchases.stepCancelled')}
          </span>
        </div>
      </div>
    );
  }

  const currentIndex = STEP_INDEX[activeStep] ?? 0;

  return (
    <div className="bg-orange-50 rounded-xl border border-orange-100 px-3 py-4">
      <p className="text-[11px] font-semibold text-orange-700 mb-3">
        {t('purchases.currentStatusFlow')}
      </p>
      <div className="flex items-center overflow-x-auto no-scrollbar">
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;
          const isReached = index <= currentIndex;
          const showLabel = isCurrent || isNext;

          return (
            <div key={step.status} className="contents">
              <div
                className={`flex flex-col items-center shrink-0 ${
                  isCurrent ? 'rounded-lg py-1.5 px-2 bg-orange-100' : 'px-1'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    isReached
                      ? 'bg-orange-400'
                      : 'bg-white border-2 border-orange-200'
                  }`}
                />
                {showLabel && (
                  <p
                    className={`text-center mt-2 leading-tight whitespace-nowrap ${
                      isCurrent
                        ? 'text-[11px] font-medium text-gray-800'
                        : 'text-[10px] text-orange-400'
                    }`}
                  >
                    {t(step.labelKey)}
                  </p>
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 min-w-[8px] ${
                    index < currentIndex ? 'bg-orange-400' : 'bg-orange-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
