import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function VantaClouds() {
  const nodeRef = useRef(null);
  const effectRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      window.THREE = THREE;
      await import('vanta/dist/vanta.clouds.min');
      const CLOUDS = window.VANTA?.CLOUDS;
      if (cancelled || !nodeRef.current || effectRef.current || typeof CLOUDS !== 'function') return;
      effectRef.current = CLOUDS({
        el: nodeRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        backgroundColor: 0xf5f7fa,
        cloudColor: 0xadc1d8,
        cloudShadowColor: 0x1e3650,
        sunGlareColor: 0xff6633,
        sunlightColor: 0xff9933,
        speed: 1,
      });
      const canvas = nodeRef.current.querySelector('canvas');
      if (canvas) {
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.pointerEvents = 'none';
      }
    }
    start();
    return () => {
      cancelled = true;
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  return <div ref={nodeRef} className="vanta-layer" aria-hidden="true" />;
}
