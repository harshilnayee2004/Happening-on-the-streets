import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ value, label = 'QR code' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return undefined;
    let cancelled = false;
    QRCode.toCanvas(canvasRef.current, value, { width: 180, margin: 1 }, (err) => {
      if (cancelled || !err) return;
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, 180, 180);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value) return null;
  return <canvas ref={canvasRef} className="qr-canvas" width={180} height={180} aria-label={label} />;
}
