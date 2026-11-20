import React, { useMemo } from 'react';
import { buildQrSvgModel, generateQrPngDataUrl } from '../../utils/qrCodeGenerator';

export { buildQrSvgModel, generateQrPngDataUrl };

/**
 * Synchronous, real ISO/IEC 18004 QR code rendered as crisp vector SVG.
 * Returns null when no value is provided rather than rendering a decorative icon.
 */
export const RealQrCode = ({
  value,
  size = 128,
  level = 'M',
  margin = 2,
  fgColor = '#000000',
  bgColor = '#ffffff',
  title,
  className,
  style
}) => {
  const model = useMemo(
    () => buildQrSvgModel(value, { level, margin }),
    [value, level, margin]
  );

  if (!model) return null;

  return (
    <svg
      role="img"
      aria-label={title || 'QR Code'}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${model.viewSize} ${model.viewSize}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'block', background: bgColor, ...style }}
    >
      <rect width={model.viewSize} height={model.viewSize} fill={bgColor} />
      <path d={model.pathData} fill={fgColor} />
    </svg>
  );
};
