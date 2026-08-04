// Converts the restaurant logo into a 1-bit monochrome ESC/POS raster
// image (GS v 0), using Floyd–Steinberg error-diffusion dithering instead
// of a flat grayscale threshold — the difference between a blurry gray
// blob and a crisp, recognizable logo on a 203 DPI thermal head.
//
// Runs entirely client-side via <canvas>; only ever called from the
// browser (printer-store.ts / Print Bill), never at module-eval time.

const ESC_GS = "\x1D";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load logo image: ${src}`));
    img.src = src;
  });
}

/**
 * Returns the raw ESC/POS bytes (as a JS string, one char per byte) for
 * printing `logoUrl` at up to `targetWidthPx` wide, or null if the logo
 * can't be loaded/processed — callers should just skip the logo and print
 * the text header only in that case, never fail the whole print job.
 */
export async function logoToEscPosRaster(logoUrl: string, targetWidthPx: number): Promise<string | null> {
  if (typeof document === "undefined" || !logoUrl) return null;

  try {
    const img = await loadImage(logoUrl);

    // Raster width must be a multiple of 8 (each output byte = 8 dots).
    const widthPx = Math.max(8, Math.floor(Math.min(targetWidthPx, img.width || targetWidthPx) / 8) * 8);
    const heightPx = Math.max(1, Math.round(img.height * (widthPx / (img.width || widthPx))));

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // White background first — logos with transparency would otherwise
    // dither against black and print as a solid smudge.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    const { data } = ctx.getImageData(0, 0, widthPx, heightPx);

    // Luminance grid for Floyd–Steinberg (float, so accumulated error
    // isn't clipped between pixels).
    const gray = new Float32Array(widthPx * heightPx);
    for (let i = 0; i < widthPx * heightPx; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const bit = new Uint8Array(widthPx * heightPx); // 1 = black dot
    for (let y = 0; y < heightPx; y++) {
      for (let x = 0; x < widthPx; x++) {
        const idx = y * widthPx + x;
        const old = gray[idx];
        const isBlack = old < 128;
        bit[idx] = isBlack ? 1 : 0;
        const error = old - (isBlack ? 0 : 255);

        if (x + 1 < widthPx) gray[idx + 1] += (error * 7) / 16;
        if (y + 1 < heightPx) {
          if (x > 0) gray[idx + widthPx - 1] += (error * 3) / 16;
          gray[idx + widthPx] += (error * 5) / 16;
          if (x + 1 < widthPx) gray[idx + widthPx + 1] += (error * 1) / 16;
        }
      }
    }

    // Pack into MSB-first bytes for GS v 0.
    const widthBytes = widthPx / 8;
    const packed = new Uint8Array(widthBytes * heightPx);
    for (let y = 0; y < heightPx; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          const x = xByte * 8 + b;
          if (bit[y * widthPx + x]) byte |= 0x80 >> b;
        }
        packed[y * widthBytes + xByte] = byte;
      }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightPx & 0xff;
    const yH = (heightPx >> 8) & 0xff;

    let out = `${ESC_GS}v0${String.fromCharCode(0)}${String.fromCharCode(xL)}${String.fromCharCode(xH)}${String.fromCharCode(yL)}${String.fromCharCode(yH)}`;
    for (let i = 0; i < packed.length; i++) out += String.fromCharCode(packed[i]);
    return out;
  } catch {
    // Logo failed to load/decode (e.g. blocked by CORS, bad path) — the
    // receipt should still print with just the text header.
    return null;
  }
}
