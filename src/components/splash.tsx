import { useEffect, useRef, useState } from 'react';
import { playSplashChime } from '@/lib/sounds';

const SPLASH_MS = 3400;
const SPLASH_EXIT_MS = 480;

/**
 * Retro cinematic "MeMyMate by ARCT" launch screen.
 * CRT scanlines, a glowing transparent ARCT logo, a boot progress bar and
 * synthesized retro chime chords (C — F — G — C) from the live sound engine.
 * Any key, tap or click skips it.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Best effort: browsers may block audio until the first user gesture,
    // in which case the chime simply stays silent and the visuals carry it.
    playSplashChime();
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      setLeaving(true);
      window.setTimeout(() => onDoneRef.current(), SPLASH_EXIT_MS);
    };
    const timer = window.setTimeout(finish, SPLASH_MS);
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, []);

  return (
    <div className={`splash${leaving ? ' splash-leaving' : ''}`} data-testid="status-splash" role="status" aria-label="MeMyMate by ARCT is starting">
      <div className="splash-crt" aria-hidden="true" />
      <div className="splash-vignette" aria-hidden="true" />
      <div className="splash-inner">
        <div className="splash-mark">
          <img src={`${import.meta.env.BASE_URL}arct-logo.png`} alt="ARCT" className="splash-logo" />
        </div>
        <h1 className="splash-title">MeMyMate</h1>
        <p className="splash-byline">
          by <b>ARCT</b>
        </p>
        <div className="splash-boot">
          <span>initializing study arena</span>
          <span className="splash-cursor" aria-hidden="true" />
        </div>
        <div className="splash-bar" aria-hidden="true">
          <i />
        </div>
        <p className="splash-footer">
          <span className="splash-blink">▮</span> press any key to skip <span className="splash-blink">▮</span>
        </p>
      </div>
    </div>
  );
}
