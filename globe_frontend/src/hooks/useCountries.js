/**
 * GeoJSON loading, preprocessing, spherical point-in-polygon testing,
 * and outline geometry building for rendering country highlights.
 * All computations are client-side and lightweight for Vite+React ESM.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Convert lat/lon (degrees) to 3D unit vector on sphere of radius r (default 1).
 */
function latLonToVector3(latDeg, lonDeg, r = 1.001) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.sin(lon);
  return new THREE.Vector3(x, y, z).multiplyScalar(r);
}

/**
 * Compute a simple lon/lat AABB for quick rejection.
 */
function computeBounds(coords) {
  // coords is array of [lon, lat]
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Ray casting algorithm for point-in-polygon on lon/lat plane.
 * Handles simple polygons; MultiPolygon is handled at feature level.
 */
function pointInPolygonLonLat(point, polygon) {
  // point: [lon, lat]
  // polygon: array of [lon, lat], ring closed or open
  const x = point[0];
  const y = point[1];

  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check point in MultiPolygon or Polygon feature (in lon/lat plane).
 * coords structure follows GeoJSON: Polygon: [ [ring1], [hole1], ... ]
 * MultiPolygon: [ [ [ring1], [hole1] ], ... ]
 */
function pointInFeatureLonLat(point, geometry) {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    // outer ring
    if (!pointInPolygonLonLat(point, rings[0])) return false;
    // holes
    for (let i = 1; i < rings.length; i++) {
      if (pointInPolygonLonLat(point, rings[i])) return false;
    }
    return true;
  }

  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      const rings = poly;
      if (!rings || rings.length === 0) continue;
      if (!pointInPolygonLonLat(point, rings[0])) continue;
      let inHole = false;
      for (let i = 1; i < rings.length; i++) {
        if (pointInPolygonLonLat(point, rings[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }

  return false;
}

/**
 * Build a THREE.LineSegments (edges) geometry from polygon rings projected onto sphere.
 * We build flat arrays of vertices and indices. A slight extrusion (r > 1) lifts it off the surface.
 */
export function buildCountryOutlineGeometry(geometry, radius = 1.003) {
  const positions = [];

  const pushRing = (ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const va = latLonToVector3(a[1], a[0], radius);
      const vb = latLonToVector3(b[1], b[0], radius);
      positions.push(va.x, va.y, va.z);
      positions.push(vb.x, vb.y, vb.z);
    }
  };

  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    for (const ring of rings) pushRing(ring);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) pushRing(ring);
    }
  }

  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(positions);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geom;
}

/**
 * Preprocess features:
 * - Normalize rings to ensure closed rings for outline continuity.
 * - Cache bounding boxes in lon/lat for fast rejection.
 */
function preprocessFeatures(features) {
  return features.map((f) => {
    const g = f.geometry;
    const clone = {
      ...f,
      geometry: JSON.parse(JSON.stringify(g)),
      __bounds: null,
    };

    const collectAllCoords = [];

    const ensureClosed = (ring) => {
      if (!ring.length) return ring;
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      return ring;
    };

    if (g.type === 'Polygon') {
      clone.geometry.coordinates = g.coordinates.map((ring) => {
        const r = ensureClosed(ring.slice());
        collectAllCoords.push(...r);
        return r;
      });
    } else if (g.type === 'MultiPolygon') {
      clone.geometry.coordinates = g.coordinates.map((poly) =>
        poly.map((ring) => {
          const r = ensureClosed(ring.slice());
          collectAllCoords.push(...r);
          return r;
        })
      );
    }

    clone.__bounds = computeBounds(collectAllCoords);
    return clone;
  });
}

/**
 * PUBLIC_INTERFACE
 * React hook that loads countries GeoJSON and prepares data for hit-testing and rendering.
 */
export function useCountries() {
  const [countries, setCountries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    let isMounted = true;
    const g = globalThis;
    g.fetch('/data/countries.geojson')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load countries.geojson (${r.status})`);
        return r.json();
      })
      .then((gj) => {
        if (!gj || !gj.features) throw new Error('Invalid GeoJSON format');
        const pre = preprocessFeatures(gj.features);
        if (isMounted) {
          setCountries(pre);
          setLoaded(true);
        }
      })
      .catch((e) => {
        g.console && g.console.error && g.console.error(e);
        if (isMounted) {
          setError(e);
          setLoaded(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Find country by lon/lat using bounds rejection and point-in-polygon.
  const findCountryAt = (lat, lon) => {
    if (!countries.length) return null;
    const pt = [lon, lat];

    // Fast pass: bounds filter
    const candidates = [];
    for (const f of countries) {
      const b = f.__bounds;
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
      candidates.push(f);
    }

    for (const f of candidates) {
      if (pointInFeatureLonLat(pt, f.geometry)) {
        return f;
      }
    }
    return null;
  };

  // Build (or reuse) outline geometry for selected feature
  const getOutlineFor = (feature) => {
    if (!feature) return null;
    const key = feature.properties?.ISO_A3 || feature.properties?.ADMIN || Math.random().toString(36);
    if (!cacheRef.current[key]) {
      cacheRef.current[key] = buildCountryOutlineGeometry(feature.geometry);
    }
    return cacheRef.current[key];
  };

  return { countries, loaded, error, findCountryAt, getOutlineFor };
}
