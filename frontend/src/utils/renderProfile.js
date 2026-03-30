import { useEffect, useState } from 'react';

export const VISUAL_EFFECTS_KEY = 'finman_reduce_effects';

export const getRenderProfile = () => {
  if (typeof window === 'undefined') {
    return {
      reducedMotion: false,
      reduceEffects: false,
      isMobile: false,
      lowMemory: false,
      lowCpu: false,
      allowThreeBackground: true,
      allowAuthAccent: true,
      allowEnhancedLoader: true,
    };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduceEffects = window.localStorage.getItem(VISUAL_EFFECTS_KEY) === '1';
  const isMobile = window.innerWidth < 768;
  const lowMemory = typeof navigator !== 'undefined' && Number(navigator.deviceMemory || 8) <= 4;
  const lowCpu = typeof navigator !== 'undefined' && Number(navigator.hardwareConcurrency || 8) <= 4;

  const allowThreeBackground = !(reducedMotion || reduceEffects || isMobile || lowMemory || lowCpu);
  const allowAuthAccent = !(reducedMotion || reduceEffects || isMobile || lowMemory);
  const allowEnhancedLoader = !(reducedMotion || reduceEffects || lowMemory);

  return {
    reducedMotion,
    reduceEffects,
    isMobile,
    lowMemory,
    lowCpu,
    allowThreeBackground,
    allowAuthAccent,
    allowEnhancedLoader,
  };
};

export const useRenderProfile = () => {
  const [profile, setProfile] = useState(() => getRenderProfile());

  useEffect(() => {
    const update = () => setProfile(getRenderProfile());

    update();
    window.addEventListener('resize', update);
    window.addEventListener('storage', update);

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('storage', update);
      media.removeEventListener?.('change', update);
    };
  }, []);

  return profile;
};
