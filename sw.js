// sw.js — Microsoft Buildings footprint tile service worker

// Bing dataset root
const ROOT = "https://minedbuildings.z5.web.core.windows.net/global-buildings";

// Convert NDJSON -> FeatureCollection GeoJSON
async function ndjsonToGeoJSON(ndjsonText) {
    const features = ndjsonText
        .trim()
        .split("\n")
        .map(line => JSON.parse(line));

    return {
        type: "FeatureCollection",
        features
    };
}

self.addEventListener("install", (event) => {
    console.log("[SW] Install");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("[SW] Activate");
    event.waitUntil(self.clients.claim());
});

// Intercept quadkey tile requests
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Only handle /quad/{z}/{x}/{y}.geojson
    if (!url.pathname.startsWith("/msbuildings/quad/")) return;

    // Extract path: /quad/Z/X/Y.geojson
    const parts = url.pathname.split("/");
    const z  = parts[3];
    const x  = parts[4];
    const yPart = parts[5];
    const y = yPart.replace(".geojson", "");

    // Compute quadkey
    const quadkey = tileToQuadKey(x, y, z);

    const remoteURL = `${ROOT}/${quadkey}.ndjson`;

    event.respondWith(
        fetch(remoteURL)
            .then(resp => resp.text())
            .then(ndjson => ndjsonToGeoJSON(ndjson))
            .then(geojson => new Response(
                JSON.stringify(geojson),
                { headers: { "Content-Type": "application/json" } }
            ))
            .catch(err => {
                console.error("[SW] ERROR fetching:", remoteURL, err);
                return new Response(JSON.stringify({
                    type: "FeatureCollection",
                    features: []
                }), { headers: { "Content-Type": "application/json" } });
            })
    );
});

// ----- Quadkey helpers -----

function tileToQuadKey(x, y, z) {
    let quadkey = "";
    for (let i = z; i > 0; i--) {
        let digit = 0;
        const mask = 1 << (i - 1);
        if ((x & mask) !== 0) digit++;
        if ((y & mask) !== 0) digit += 2;
        quadkey += digit.toString();
    }
    return quadkey;
}
