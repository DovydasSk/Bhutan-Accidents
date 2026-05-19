import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Pane } from 'react-leaflet';
import L from 'leaflet';

// Bhutan bounding box — constrain the map so the user can't pan to other countries
const BHUTAN_BOUNDS = L.latLngBounds(
  L.latLng(26.6, 88.6),   // SW corner
  L.latLng(28.4, 92.2)    // NE corner
);

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AccidentMap({ data }) {
  const [boundary, setBoundary] = useState(null);

  useEffect(() => {
    fetch('/data/bhutan.geojson')
      .then((r) => r.json())
      .then(setBoundary)
      .catch(() => {});
  }, []);

  // Performance: cap to ~3000 visible points. Keep all fatal ones; sample non-fatal.
  const points = useMemo(() => {
    if (data.length <= 3000) return data;
    const fatal = data.filter((a) => (a.deaths || 0) > 0);
    const nonFatal = data.filter((a) => (a.deaths || 0) === 0);
    const target = 3000 - fatal.length;
    const step = Math.ceil(nonFatal.length / Math.max(target, 1));
    const sampled = nonFatal.filter((_, i) => i % step === 0);
    return [...fatal, ...sampled];
  }, [data]);

  const sampled = points.length < data.length;

  return (
    <div style={{ position: 'relative' }}>
      <div className="map-container">
        <MapContainer
          bounds={BHUTAN_BOUNDS}
          maxBounds={BHUTAN_BOUNDS}
          maxBoundsViscosity={1.0}
          minZoom={7}
          maxZoom={17}
          style={{ height: '100%', width: '100%', background: '#eef2f6' }}
          scrollWheelZoom={true}
          zoomControl={true}
          attributionControl={true}
        >
          {/* Base map: OpenStreetMap — shows roads, towns, terrain labels.
              No API key required. */}
          <Pane name="tile-pane" style={{ zIndex: 200 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </Pane>

          {/* Bhutan boundary on top of tiles — outline only so roads remain visible */}
          <Pane name="bhutan-pane" style={{ zIndex: 300 }}>
            {boundary && (
              <GeoJSON
                data={boundary}
                style={{
                  color: '#1a2332',
                  weight: 2,
                  fillColor: '#000000',
                  fillOpacity: 0,        // transparent fill so OSM tiles show through
                  opacity: 0.7,
                }}
              />
            )}
          </Pane>

          {points.map((a) => {
            const fatal = (a.deaths || 0) > 0;
            const injured = !fatal && (a.injured || 0) > 0;
            // fatal=red, injured=orange, damage-only=slate-gray (was blue; gray reads better as "no casualties")
            const color = fatal ? '#dc2626' : injured ? '#f59e0b' : '#64748b';
            const radius = fatal ? 7 : injured ? 5 : 4;
            return (
              <CircleMarker
                key={a.id}
                center={[a.lat, a.lon]}
                radius={radius}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="popup-card">
                    <h3>{a.accident_type || 'Accident'}</h3>
                    <div className="popup-row">
                      <span className="label">Date</span>
                      <span className="value">
                        {formatDate(a.date)} {a.time ? `· ${a.time}` : ''}
                      </span>
                    </div>
                    <div className="popup-row">
                      <span className="label">Location</span>
                      <span className="value">{a.location || a.place || '—'}</span>
                    </div>
                    <div className="popup-row">
                      <span className="label">District</span>
                      <span className="value">{a.dzongkhag || '—'}</span>
                    </div>
                    {a.gewog && (
                      <div className="popup-row">
                        <span className="label">Gewog</span>
                        <span className="value">{a.gewog}</span>
                      </div>
                    )}
                    <div className="popup-row">
                      <span className="label">Division</span>
                      <span className="value">{a.division || '—'}</span>
                    </div>
                    <div className="popup-divider" />
                    <div className="popup-row">
                      <span className="label">Deaths</span>
                      <span className={`value ${a.deaths ? 'danger' : ''}`}>{a.deaths || 0}</span>
                    </div>
                    <div className="popup-row">
                      <span className="label">Injured</span>
                      <span className="value">{a.injured || 0}</span>
                    </div>
                    <div className="popup-divider" />
                    <div className="popup-row">
                      <span className="label">Vehicle</span>
                      <span className="value">{a.vehicle_type || '—'}</span>
                    </div>
                    {a.vehicle_no && (
                      <div className="popup-row">
                        <span className="label">Vehicle no.</span>
                        <span className="value">{a.vehicle_no}</span>
                      </div>
                    )}
                    {a.cause && (
                      <div className="popup-row">
                        <span className="label">Cause</span>
                        <span className="value">{a.cause}</span>
                      </div>
                    )}
                    {a.accident_spot && (
                      <div className="popup-row">
                        <span className="label">Spot</span>
                        <span className="value">{a.accident_spot}</span>
                      </div>
                    )}
                    {a.status_of_victim && (
                      <div className="popup-row">
                        <span className="label">Status</span>
                        <span className="value">{a.status_of_victim}</span>
                      </div>
                    )}
                    {Array.isArray(a.type_of_victim) && a.type_of_victim.length > 0 && (
                      <div className="popup-row">
                        <span className="label">Victim type</span>
                        <span className="value">{a.type_of_victim.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #e1e5eb',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 11,
          color: '#1a2332',
          zIndex: 1000,
          lineHeight: 1.6,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block', border: '1.5px solid white', boxShadow: '0 0 0 1px #dc2626' }} />
          Fatal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', border: '1.5px solid white', boxShadow: '0 0 0 1px #f59e0b' }} />
          Injuries
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', display: 'inline-block', border: '1.5px solid white', boxShadow: '0 0 0 1px #64748b' }} />
          Vehicle damage
        </div>
      </div>

      {sampled && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e1e5eb',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            color: '#6b7785',
            zIndex: 1000,
          }}
        >
          Showing {points.length.toLocaleString()} of {data.length.toLocaleString()} points (sampled · fatal accidents always kept)
        </div>
      )}
    </div>
  );
}
