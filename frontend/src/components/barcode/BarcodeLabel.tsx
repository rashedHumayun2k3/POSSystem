'use client';

import { code128Bars, code128Width, validateBarcode, type LabelItem } from '@/lib/barcodeLabels';

type Props = {
  item: LabelItem;
  widthMm: number;
  heightMm: number;
};

export default function BarcodeLabel({ item, widthMm, heightMm }: Props) {
  const error = validateBarcode(item.barcode);
  const compact = heightMm < 27;
  let variantLabel = '';
  try {
    variantLabel = Object.values(JSON.parse(item.variantValuesJson || '{}') as Record<string, string>)
      .filter(Boolean)
      .join(' / ');
  } catch {
    variantLabel = '';
  }

  return (
    <div
      className="barcode-label-box"
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
    >
      <div className="barcode-label-name" title={item.productName}>{item.productName}</div>
      {variantLabel && <div className="barcode-label-variant">{variantLabel}</div>}
      {error ? (
        <div className="barcode-label-error">{error}</div>
      ) : (
        <Code128Svg value={item.barcode} compact={compact} />
      )}
      <div className="barcode-label-value">{item.barcode}</div>
      <div className="barcode-label-price">৳{item.sellingPrice.toLocaleString('en-BD', { maximumFractionDigits: 2 })}</div>
    </div>
  );
}

function Code128Svg({ value, compact }: { value: string; compact: boolean }) {
  const bars = code128Bars(value);
  const width = code128Width(value);
  return (
    <svg
      className="barcode-label-svg"
      viewBox={`0 0 ${width} ${compact ? 34 : 44}`}
      role="img"
      aria-label={`Code 128 barcode ${value}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <rect width={width} height="100%" fill="white" />
      {bars.map((bar, index) => (
        <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width} height="100%" fill="black" />
      ))}
    </svg>
  );
}
