import { useEffect, useState } from 'react';
import { RadioTower } from 'lucide-react';
import { adsEnabled, currentAdSlot, type AdSlotState } from '@/lib/ads';

/**
 * A premium, non-disturbing billboard for the Great Liberal Ads.
 * Renders nothing at all when the ARCT_Liberal_Ads folder holds no creatives.
 * The creative on screen is synced to the global clock for every visitor.
 */
export function AdSlot({ compact = false }: { compact?: boolean }) {
  const [slot, setSlot] = useState<AdSlotState | null>(() => currentAdSlot());

  useEffect(() => {
    if (!adsEnabled) return;
    const update = () => setSlot(currentAdSlot());
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!adsEnabled || !slot) return null;
  const { ad, remaining } = slot;
  const progress = Math.max(0, Math.min(100, (remaining / ad.duration) * 100));

  return (
    <section
      className={`ad-billboard${compact ? ' compact' : ''}`}
      data-testid="ad-slot"
      aria-label="Synchronized ARCT Liberal Ads message"
    >
      <div className="ad-head">
        <span className="ad-badge">
          <RadioTower size={11} /> ARCT · Liberal Ads
        </span>
        <span className="ad-sync" data-testid="text-ad-timer">
          perfectly synced · {remaining}s
        </span>
      </div>
      <div className={`ad-media ${ad.kind}`}>
        {ad.kind === 'image' ? (
          <img src={ad.url} alt={`Sponsored message ${ad.name}`} loading="lazy" />
        ) : (
          <video src={ad.url} muted playsInline autoPlay loop preload="metadata" aria-label={`Sponsored message ${ad.name}`} />
        )}
      </div>
      <div className="ad-progress" role="presentation">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="ad-note">Elegant, non-intrusive, perfectly synced — Liberal Ads keep free learning alive for everyone.</p>
    </section>
  );
}
