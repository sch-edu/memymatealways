# ARCT Liberal Ads

This folder powers the "Great Liberal Ads" system of MeMyMate by ARCT.

Drop ad creatives in this folder using these naming conventions:

- **Image ads:** `1.png`, `2.png`, `3.png` … (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)
- **Video ads:** `1.mp4`, `2.mp4` … (`.mp4`, `.webm`, `.ogg`, `.mov`, `.m4v`)

Behavior:

- **No files present** → the website shows **no ads at all** (premium, ad-free experience).
- **Files present** → ads appear in elegant, non-disturbing billboard slots that are
  **perfectly synced**: the rotation is derived from a shared global clock, so every
  visitor sees the same creative at the same moment.
- **PNG/image ads** are shown for exactly **5 seconds** each.
- **Video ads** are shown for exactly **13 seconds** each (videos should be 13s long).
- Files are discovered at **build time** (`npm run build`) via Vite's static asset
  globbing — add or remove files, rebuild, and the rotation updates automatically.

Any other files in this folder (like this README) are ignored.
