import type { FulfillmentStatus, OrderStatus } from '@/types/orders';

type Translate = (key: string) => string;

type OrderStep = {
  key: string;
  labelKey: string;
  pendingLabelKey?: string;
  reachedAt: number;
};

type OrderProgressProps = {
  isDraft: boolean;
  fulfillmentStatus: FulfillmentStatus;
  orderStatus: OrderStatus;
  t: Translate;
};

export function OrderProgress({ isDraft, fulfillmentStatus, orderStatus, t }: OrderProgressProps) {
  const isCancelled = orderStatus === 'CANCELLED';
  const isReturned = fulfillmentStatus === 'RETURNED';

  if (isCancelled || isReturned) {
    return (
      <div className="mt-1.5 flex items-center gap-2 rounded-md bg-red-50 px-2 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-[9px] font-medium leading-tight text-red-700">
          {t(isCancelled ? 'orders.stepCancelled' : 'orders.stepReturned')}
        </span>
      </div>
    );
  }

  const stageIndex =
    fulfillmentStatus === 'DELIVERED' ? 3 :
    fulfillmentStatus === 'IN_TRANSIT' ? 2 :
    1;

  const steps: OrderStep[] = [
    { key: 'created', labelKey: 'orders.stepCreated', reachedAt: 0 },
    {
      key: 'confirmed',
      labelKey: 'orders.stepConfirmed',
      pendingLabelKey: 'orders.stepConfirmedPending',
      reachedAt: isDraft ? 99 : 1,
    },
    {
      key: 'handedOver',
      labelKey: 'orders.stepHandedOver',
      pendingLabelKey: 'orders.stepHandedOverPending',
      reachedAt: stageIndex >= 2 ? 2 : 99,
    },
    {
      key: 'delivered',
      labelKey: 'orders.stepDelivered',
      pendingLabelKey: 'orders.stepDeliveredPending',
      reachedAt: stageIndex >= 3 ? 3 : 99,
    },
  ];

  const currentIndex = steps.reduce((max, step, index) =>
    step.reachedAt !== 99 ? Math.max(max, index) : max, 0);

  return (
    <div className="mt-1.5 flex items-start">
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReached = index <= currentIndex && step.reachedAt !== 99;
        const labelKey = isReached ? step.labelKey : step.pendingLabelKey ?? step.labelKey;
        const shouldShowLabel = isCurrent || index === currentIndex + 1;

        return (
          <div key={step.key} className="contents">
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
                  {t(labelKey)}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
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

type OrderProcessGuideProps = {
  activeStep: string;
  t: Translate;
};

const GUIDE_STEPS = [
  { key: 'UNFULFILLED', labelKey: 'orders.newOrders' },
  { key: 'WAITING_COURIER', labelKey: 'orders.waitingForCourier' },
  { key: 'PENDING', labelKey: 'dashboard.pendingDeliveries' },
  { key: 'DELIVERED', labelKey: 'orders.delivered' },
  { key: 'RETURNED', labelKey: 'orders.returned' },
  { key: 'CANCELLED', labelKey: 'status.CANCELLED' },
];

export function OrderProcessGuide({ activeStep, t }: OrderProcessGuideProps) {
  if (!activeStep) return null;

  const currentIndex = GUIDE_STEPS.findIndex((step) => step.key === activeStep);
  if (currentIndex < 0) return null;

  return (
    <div className="bg-orange-50 rounded-xl border border-orange-100 px-3 py-4">
      <p className="text-[11px] font-semibold text-orange-700 mb-3">
        {t('orders.currentStatusFlow')}
      </p>
      <div className="flex items-center overflow-x-auto no-scrollbar">
        {GUIDE_STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;
          const isReached = index <= currentIndex;
          const showLabel = isCurrent || isNext;

          return (
            <div key={step.key} className="contents">
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
              {index < GUIDE_STEPS.length - 1 && (
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
