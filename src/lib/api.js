// Client-side bridge to the AI matching module (server/analyzeMeal.mjs),
// plus the photo down-scaler that keeps stored images small.

// Downscale + re-encode a photo so it is cheap to send and store.
export function preparePhoto(file, maxEdge = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({
        dataUrl,
        base64: dataUrl.split(",")[1],
        mediaType: "image/jpeg",
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file."));
    };
    img.src = url;
  });
}

// Calls the isolated AI matching endpoint. Returns { engine, result }.
export async function requestMealAnalysis({ base64, mediaType, note, protocol }) {
  const res = await fetch("/api/analyze-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType, note, protocol }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Analysis failed (${res.status})`);
  }
  return res.json();
}
