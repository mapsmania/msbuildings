// sw.js — Microsoft Buildings tiled GeoJSON service worker

const ROOT = "https://minedbuildings.z5.web.core.windows.net/global-buildings";

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

self.addEventListener("install", () => {
    console.log("[SW] Install");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("[SW] Activate");
    event.waitUntil(self.clients.claim());
});

// Intercept only quad requests
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Only intercept real quad tiles
    if (!url.pathname.startsWith("/msbuildings/quad/")) return;

    // Path: /msbuildings/quad/Z/X/Y.geojson
    const parts = url.pathname.split("/");
    const z = parts[3];
    const x = parseInt(parts[4], 10);
    const y = parseInt(parts[5].replace(".geojson", ""), 10);

    const quadkey = tileToQuadKey(x, y, z);
    const remoteURL = `${ROOT}/${quadkey}.ndjson`;

    event.respondWith(
        fetch(remoteURL)
            .then(r => r.text())
            .then(txt => ndjsonToGeoJSON(txt))
            .then(geojson =>
                new Response(JSON.stringify(geojson), {
                    headers: { "Content-Type": "application/json" }
                })
            )
            .catch(err => {
                console.error("[SW] Error loading", remoteURL, err);
                return new Response(
                    JSON.stringify({
                        type: "FeatureCollection",
                        features: []
                    }),
                    { headers: { "Content-Type": "application/json" } }
                );
            })
    );
});

function tileToQuadKey(x, y, z) {
    let quadkey = "";
    for (let i = z; i > 0; i--) {
        let digit = 0;
        const mask = 1 << (i - 1);
        if (x & mask) digit++;
        if (y & mask) digit += 2;
        quadkey += digit.toString();
    }
    return quadkey;
}
