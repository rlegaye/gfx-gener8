/* Poochtooth Pattern Generator (dependency-free) */

const FALLBACK_FAMILY = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeMessage(raw) {
  const up = (raw ?? "").toString().toUpperCase();
  // Keep common readable characters; replace runs of whitespace with a single space
  // Preserve newlines; normalize horizontal whitespace
  return up
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function ensureCanvasSize(canvas, w, h) {
  const nw = clamp(Math.floor(w), 64, 16000);
  const nh = clamp(Math.floor(h), 64, 16000);
  if (canvas.width !== nw) canvas.width = nw;
  if (canvas.height !== nh) canvas.height = nh;
}

function measureCell(ctx, fontSizePx) {
  ctx.save();
  // ctx.font is expected to be set by the caller; this function just measures.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Measure a representative character; fallback if metrics unavailable
  const metrics = ctx.measureText("M");
  const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2;
  const height = ascent + descent;

  const m2 = ctx.measureText("W");
  const width = m2.width || fontSizePx * 0.6;

  ctx.restore();
  return { width, height, ascent, descent };
}

function drawLineWithSpacing(ctx, text, xStart, yBaseline, letterSpacingPx) {
  let x = xStart;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, x, yBaseline);
    const w = ctx.measureText(ch).width || 0;
    x += w + letterSpacingPx;
  }
  return x;
}

function estimateSegmentWidth(ctx, segment, letterSpacingPx) {
  let w = 0;
  for (let i = 0; i < segment.length; i++) {
    w += (ctx.measureText(segment[i]).width || 0) + letterSpacingPx;
  }
  return Math.max(1, w);
}

function escapeXml(text) {
  return (text ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT_SOURCES = {
  Poochtooth: { path: "./poochtooth.ttf", format: "truetype", mime: "font/ttf" },
  Herring: { path: "./herring.otf", format: "opentype", mime: "font/otf" },
};

const fontDataUrlCache = new Map();

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function getFontDataUrl(fontFamily) {
  const family = fontFamily || "Poochtooth";
  if (fontDataUrlCache.has(family)) return fontDataUrlCache.get(family);

  const src = FONT_SOURCES[family] || FONT_SOURCES.Poochtooth;
  const res = await fetch(src.path);
  if (!res.ok) throw new Error(`Failed to fetch font for SVG: ${src.path}`);
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  const dataUrl = `data:${src.mime};base64,${b64}`;
  fontDataUrlCache.set(family, { dataUrl, format: src.format, family });
  return fontDataUrlCache.get(family);
}

function renderText(opts) {
  const {
    canvas,
    messageRaw,
    width,
    height,
    fontSizePx,
    fontFamily,
    fgColor,
    bgColor,
    letterSpacingPx,
    lineSpacingPx,
    repeatToFill,
    repeatGapPx,
    alternateFlip,
    alternateMirror,
  } = opts;

  ensureCanvasSize(canvas, width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Font setup
  ctx.save();
  ctx.fillStyle = fgColor;
  ctx.font = `${fontSizePx}px ${fontFamily}, ${FALLBACK_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const msg = normalizeMessage(messageRaw);
  const lines = msg ? msg.split("\n") : [""];
  const metrics = measureCell(ctx, fontSizePx);
  const safeLineSpacing = clamp(lineSpacingPx, -200, 500);
  const lineHeight = Math.max(1, metrics.ascent + metrics.descent + safeLineSpacing);

  const safeLetterSpacing = clamp(letterSpacingPx, -100, 500);
  const safeRepeatGap = clamp(repeatGapPx, -500, 2000);
  const flipEveryOther = Boolean(alternateFlip);
  const mirrorEveryOther = Boolean(alternateMirror);

  const drawOneLine = (text, yTop, rowIndex) => {
    const yBaseline = yTop + metrics.ascent;
    const lineText = text.length ? text : " ";
    const segment = lineText;

    let x = 0;
    let segIndex = 0;
    while (x < canvas.width) {
      // Alternate transforms per segment to create texture without distorting spacing math too much
      const doAlt = (rowIndex + segIndex) % 2 === 1;
      const doFlip = flipEveryOther && doAlt;
      const doMirror = mirrorEveryOther && doAlt;

      if (doFlip || doMirror) {
        const segW = estimateSegmentWidth(ctx, segment, safeLetterSpacing) + safeRepeatGap;
        const cx = x + segW / 2;
        const cy = yTop + lineHeight / 2;
        ctx.save();
        ctx.translate(cx, cy);
        if (doFlip) ctx.rotate(Math.PI);
        if (doMirror) ctx.scale(-1, 1);
        ctx.translate(-cx, -cy);
        x = drawLineWithSpacing(ctx, segment, x, yBaseline, safeLetterSpacing) + safeRepeatGap;
        ctx.restore();
      } else {
        x = drawLineWithSpacing(ctx, segment, x, yBaseline, safeLetterSpacing) + safeRepeatGap;
      }
      segIndex++;
    }
  };

  if (repeatToFill) {
    let row = 0;
    for (let y = 0; y <= canvas.height - 1; y += lineHeight) {
      const line = lines[row % lines.length] ?? "";
      drawOneLine(line, y, row);
      row++;
    }
  } else {
    // Draw once, honoring the user’s line breaks (no wrapping in this mode)
    for (let row = 0; row < lines.length; row++) {
      const y = row * lineHeight;
      if (y > canvas.height) break;
      const yBaseline = y + metrics.ascent;
      drawLineWithSpacing(ctx, lines[row] ?? "", 0, yBaseline, safeLetterSpacing);
    }
  }

  ctx.restore();
}

async function buildSvg(opts) {
  const {
    messageRaw,
    width,
    height,
    fontSizePx,
    fontFamily,
    fgColor,
    bgColor,
    letterSpacingPx,
    lineSpacingPx,
    repeatToFill,
    repeatGapPx,
    alternateFlip,
    alternateMirror,
  } = opts;

  // Use a scratch canvas for measurements so SVG repeat counts are reasonable
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d");
  if (!sctx) throw new Error("No canvas 2D context available for SVG measurement");
  sctx.font = `${fontSizePx}px ${fontFamily}, ${FALLBACK_FAMILY}`;
  sctx.textAlign = "left";
  sctx.textBaseline = "alphabetic";

  const msg = normalizeMessage(messageRaw);
  const lines = msg ? msg.split("\n") : [""];

  const metrics = (() => {
    const m = sctx.measureText("M");
    const ascent = m.actualBoundingBoxAscent || fontSizePx * 0.8;
    const descent = m.actualBoundingBoxDescent || fontSizePx * 0.2;
    return { ascent, descent };
  })();

  const safeLetterSpacing = clamp(letterSpacingPx, -100, 500);
  const safeRepeatGap = clamp(repeatGapPx, -500, 2000);
  const safeLineSpacing = clamp(lineSpacingPx, -200, 500);
  const lineHeight = Math.max(1, metrics.ascent + metrics.descent + safeLineSpacing);

  const svgParts = [];
  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(width)}" height="${Math.floor(
      height
    )}" viewBox="0 0 ${Math.floor(width)} ${Math.floor(height)}">`
  );
  svgParts.push(`<rect x="0" y="0" width="100%" height="100%" fill="${escapeXml(bgColor)}" />`);

  // Embed the font so the SVG renders the same even outside the webpage.
  const embedded = await getFontDataUrl(fontFamily);
  svgParts.push(`<style><![CDATA[
@font-face {
  font-family: '${embedded.family}';
  src: url('${embedded.dataUrl}') format('${embedded.format}');
}
text { font-family: '${embedded.family}', ${FALLBACK_FAMILY}; font-size: ${fontSizePx}px; fill: ${fgColor}; }
.t { letter-spacing: ${safeLetterSpacing}px; }
]]></style>`);

  const flipEveryOther = Boolean(alternateFlip);
  const mirrorEveryOther = Boolean(alternateMirror);

  if (repeatToFill) {
    let row = 0;
    for (let yTop = 0; yTop <= height - 1; yTop += lineHeight) {
      const baseLineText = (lines[row % lines.length] ?? "") || " ";
      const segment = `${baseLineText}`;
      const segW = estimateSegmentWidth(sctx, segment, safeLetterSpacing);
      const segStep = Math.max(1, segW + safeRepeatGap);

      // Use segments (not a giant repeated string) so we can apply repeatGap consistently.
      // Also required when alternating transforms are enabled.
      {
        const y = yTop + metrics.ascent;
        let x = 0;
        let segIndex = 0;
        while (x < width) {
          const doAlt = ((row + segIndex) % 2) === 1;
          const doFlip = flipEveryOther && doAlt;
          const doMirror = mirrorEveryOther && doAlt;

          if (doFlip || doMirror) {
            const cx = x + segW / 2;
            const cy = yTop + lineHeight / 2;
            const transforms = [];
            transforms.push(`translate(${cx} ${cy})`);
            if (doFlip) transforms.push(`rotate(180)`);
            if (doMirror) transforms.push(`scale(-1 1)`);
            transforms.push(`translate(${-cx} ${-cy})`);
            svgParts.push(
              `<g transform="${transforms.join(" ")}"><text class="t" x="${x}" y="${y}">${escapeXml(segment)}</text></g>`
            );
          } else {
            svgParts.push(`<text class="t" x="${x}" y="${y}">${escapeXml(segment)}</text>`);
          }
          x += segStep;
          segIndex++;
        }
      }

      row++;
    }
  } else {
    // Draw once, one <text> element per input line.
    for (let row = 0; row < lines.length; row++) {
      const yTop = row * lineHeight;
      if (yTop > height) break;
      const y = yTop + metrics.ascent;
      svgParts.push(`<text class="t" x="0" y="${y}">${escapeXml(lines[row] ?? "")}</text>`);
    }
  }

  svgParts.push(`</svg>`);
  return svgParts.join("\n");
}

async function init() {
  const canvas = $("patternCanvas");
  const messageInput = $("messageInput");
  const canvasWidth = $("canvasWidth");
  const canvasHeight = $("canvasHeight");
  const fontSize = $("fontSize");
  const fontSizeOut = $("fontSizeOut");
  const letterSpacing = $("letterSpacing");
  const letterSpacingOut = $("letterSpacingOut");
  const fontFamily = $("fontFamily");
  const fgColor = $("fgColor");
  const bgColor = $("bgColor");
  const lineSpacing = $("lineSpacing");
  const lineSpacingOut = $("lineSpacingOut");
  const repeatToFill = $("repeatToFill");
  const repeatGap = $("repeatGap");
  const repeatGapOut = $("repeatGapOut");
  const alternateFlip = $("alternateFlip");
  const alternateMirror = $("alternateMirror");
  const fontStatus = $("fontStatus");
  const downloadPngBtn = $("downloadPngBtn");
  const downloadSvgBtn = $("downloadSvgBtn");

  function syncOutputs() {
    fontSizeOut.value = String(fontSize.value);
    letterSpacingOut.value = String(letterSpacing.value);
    lineSpacingOut.value = String(lineSpacing.value);
    repeatGapOut.value = String(repeatGap.value);
  }

  function getOpts() {
    return {
      canvas,
      messageRaw: messageInput.value,
      width: Number(canvasWidth.value),
      height: Number(canvasHeight.value),
      fontSizePx: Number(fontSize.value),
      fontFamily: fontFamily.value || "Poochtooth",
      fgColor: fgColor.value,
      bgColor: bgColor.value,
      letterSpacingPx: Number(letterSpacing.value),
      lineSpacingPx: Number(lineSpacing.value),
      repeatToFill: Boolean(repeatToFill.checked),
      repeatGapPx: Number(repeatGap.value),
      alternateFlip: Boolean(alternateFlip.checked),
      alternateMirror: Boolean(alternateMirror.checked),
    };
  }

  function rerender() {
    syncOutputs();
    renderText(getOpts());
  }

  // Font loading
  async function ensureFontLoaded(family) {
    try {
      fontStatus.textContent = `Loading ${family}…`;
      await document.fonts.load(`32px ${family}`);
      fontStatus.textContent = `${family} ready`;
    } catch {
      fontStatus.textContent = `${family}: load failed (still trying)`;
    }
  }
  await ensureFontLoaded(fontFamily.value || "Poochtooth");

  // Defaults
  messageInput.value = "MEET AT 7";
  syncOutputs();
  rerender();

  const onInput = () => rerender();
  [
    messageInput,
    canvasWidth,
    canvasHeight,
    fontSize,
    letterSpacing,
    fontFamily,
    fgColor,
    bgColor,
    lineSpacing,
    repeatToFill,
    repeatGap,
    alternateFlip,
    alternateMirror,
  ].forEach((el) => el.addEventListener("input", onInput));

  fontFamily.addEventListener("change", async () => {
    await ensureFontLoaded(fontFamily.value || "Poochtooth");
    rerender();
  });

  downloadPngBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    const safeMsg = normalizeMessage(messageInput.value).replace(/[^A-Z0-9]+/g, "-").slice(0, 32) || "pattern";
    a.download = `poochtooth-${safeMsg}.png`;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  downloadSvgBtn.addEventListener("click", () => {
    (async () => {
      const opts = getOpts();
      const svg = await buildSvg(opts);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeMsg =
        normalizeMessage(messageInput.value).replace(/[^A-Z0-9]+/g, "-").slice(0, 32) || "pattern";
      a.download = `${opts.fontFamily.toLowerCase()}-${safeMsg}.svg`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })().catch((err) => {
      console.error(err);
      alert(`SVG export failed: ${err?.message ?? err}`);
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    alert(`Failed to initialize: ${err?.message ?? err}`);
  });
});

