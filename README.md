# Poochtooth Pattern Generator

This is a tiny, dependency-free front end that uses `poochtooth.ttf` to render your text. The font’s glyphs create a houndstooth-like texture from afar.

## Run it

### Option A: open directly
- Double-click `index.html`

Some browsers restrict loading local fonts from `file://`. If the preview looks wrong, use Option B.

### Option B: run a local server (recommended)

From the project folder:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## How it hides the message
There’s no hiding logic: the canvas is filled by **repeating your message**.

## Tips

- Use short, punchy messages (e.g. `MEET AT 7`).
- Adjust **Character spacing** and **Line spacing** to tune the weave density.
- If you see “gaps” between repeats, set **Repeat gap** to `0` (or negative to overlap).
- Switch between **Poochtooth** and **Herring** via the **Font** dropdown.
- Export via **Download PNG** or **Download SVG**.

