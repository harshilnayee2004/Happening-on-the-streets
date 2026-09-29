import { useEffect, useRef } from 'react';

function isMatterport(url) {
  return typeof url === 'string' && /matterport\.com/i.test(url);
}

function isCesiumTiles(url) {
  return typeof url === 'string' && (/tileset\.json/i.test(url) || /cesium/i.test(url));
}

function loadCesium() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-cesium]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.cesium = '1';
      link.href = 'https://unpkg.com/cesium@1.124.0/Build/Cesium/Widgets/widgets.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/cesium@1.124.0/Build/Cesium/Cesium.js';
    script.onload = () => resolve(window.Cesium);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function CesiumViewer({ showcase, compact = false }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !showcase || !isCesiumTiles(showcase.modelUrl)) return undefined;
    let viewer;
    let cancelled = false;
    loadCesium()
      .then(async (Cesium) => {
        if (cancelled || !Cesium) return;
        window.CESIUM_BASE_URL = 'https://unpkg.com/cesium@1.124.0/Build/Cesium/';
        viewer = new Cesium.Viewer(host, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
        });
        const tileset = await Cesium.Cesium3DTileset.fromUrl(showcase.modelUrl);
        viewer.scene.primitives.add(tileset);
        await viewer.zoomTo(tileset);
      })
      .catch(() => {
        if (host) host.textContent = 'Cesium tiles could not be loaded.';
      });
    return () => {
      cancelled = true;
      if (viewer) viewer.destroy();
    };
  }, [showcase]);

  if (!showcase) {
    if (compact) {
      return (
        <p className="workspace-showcase-note muted" role="status">
          No 3D tour attached yet.
        </p>
      );
    }
    return (
      <div className="cesium-slot" role="region" aria-label="3D property view">
        <p>No 3D showcase is attached to this workspace yet.</p>
      </div>
    );
  }

  if (isMatterport(showcase.modelUrl)) {
    return (
      <div className="cesium-slot" role="region" aria-label="Matterport tour">
        <iframe title="Matterport" src={showcase.modelUrl} allow="xr-spatial-tracking; fullscreen" />
      </div>
    );
  }

  if (isCesiumTiles(showcase.modelUrl)) {
    return <div ref={hostRef} className="cesium-slot cesium-slot--live" role="region" aria-label="Cesium 3D tiles" />;
  }

  if (showcase.latitude != null && showcase.longitude != null) {
    const west = showcase.longitude - 0.01;
    const south = showcase.latitude - 0.01;
    const east = showcase.longitude + 0.01;
    const north = showcase.latitude + 0.01;
    const map = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${showcase.latitude}%2C${showcase.longitude}`;
    return (
      <div className="cesium-slot" role="region" aria-label="Listing location">
        <iframe title="Map" src={map} />
        <p className="muted">Showcase coordinates. Attach a Matterport or Cesium tiles URL for a full model.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <p className="workspace-showcase-note muted" role="status">
        No 3D tour attached yet.
      </p>
    );
  }

  return (
    <div className="cesium-slot" role="region" aria-label="3D property view">
      <p>This showcase has no model URL or coordinates yet.</p>
    </div>
  );
}
