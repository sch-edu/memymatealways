/**
 * MeMyMate by ARCT — "The Great Liberal Ads" engine.
 *
 * Creatives are discovered at BUILD TIME from the `ARCT_Liberal_Ads/` folder
 * at the project root (via Vite's import.meta.glob). Drop `1.png`, `2.png`,
 * `1.mp4`, `2.mp4` … in that folder and rebuild — if the folder holds no
 * matching media, the app renders zero ads and stays fully premium.
 *
 * The rotation is "perfectly synced": the active creative is derived from a
 * shared global clock (Unix time), so every visitor sees the same ad at the
 * same moment. Image ads run for exactly 5 seconds, video ads for exactly 13.
 */

export type AdKind = 'image' | 'video';

export type AdCreative = {
  id: string;
  name: string;
  url: string;
  kind: AdKind;
  duration: number; // seconds
};

export const IMAGE_AD_SECONDS = 5;
export const VIDEO_AD_SECONDS = 13;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v']);

const adModules = import.meta.glob<string>('/ARCT_Liberal_Ads/*.{png,jpg,jpeg,webp,gif,mp4,webm,ogg,mov,m4v}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const adCreatives: AdCreative[] = Object.entries(adModules)
  .map(([path, url]) => {
    const file = path.split('/').pop() ?? '';
    const extension = file.includes('.') ? file.split('.').pop()!.toLowerCase() : '';
    const kind: AdKind | null = IMAGE_EXTENSIONS.has(extension) ? 'image' : VIDEO_EXTENSIONS.has(extension) ? 'video' : null;
    if (!kind) return null;
    return {
      id: file,
      name: file.replace(/\.[^.]+$/, ''),
      url,
      kind,
      duration: kind === 'image' ? IMAGE_AD_SECONDS : VIDEO_AD_SECONDS,
    } satisfies AdCreative;
  })
  .filter((ad): ad is AdCreative => ad !== null)
  .sort((a, b) => nameCollator.compare(a.name, b.name));

export const adsEnabled = adCreatives.length > 0;

const cycleSeconds = adCreatives.reduce((sum, ad) => sum + ad.duration, 0);

export type AdSlotState = {
  ad: AdCreative;
  index: number;
  elapsed: number;
  remaining: number;
};

/**
 * Which creative should be on screen right now? Derived from wall-clock time
 * so every client (with a synced clock) shows the identical ad — perfectly
 * synchronized across the whole audience.
 */
export function currentAdSlot(atMs: number = Date.now()): AdSlotState | null {
  if (!adCreatives.length || cycleSeconds <= 0) return null;
  let secondsIntoCycle = Math.floor(atMs / 1000) % cycleSeconds;
  for (let index = 0; index < adCreatives.length; index += 1) {
    const ad = adCreatives[index];
    if (secondsIntoCycle < ad.duration) {
      return { ad, index, elapsed: secondsIntoCycle, remaining: ad.duration - secondsIntoCycle };
    }
    secondsIntoCycle -= ad.duration;
  }
  const first = adCreatives[0];
  return { ad: first, index: 0, elapsed: 0, remaining: first.duration };
}
