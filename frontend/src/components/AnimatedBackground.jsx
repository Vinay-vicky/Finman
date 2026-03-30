import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useRenderProfile } from '../utils/renderProfile';

const ThreeFinanceScene = lazy(() => import('./ThreeFinanceScene'));

const AnimatedBackground = ({ mode = 'app' }) => {
  const profile = useRenderProfile();
  const [enableThree, setEnableThree] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!profile.allowThreeBackground) {
      setEnableThree(false);
      return;
    }

    const enable = () => setEnableThree(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enable, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(enable, 300);
    return () => window.clearTimeout(timer);
  }, [profile.allowThreeBackground]);

  const gradientStrengthClass = mode === 'auth'
    ? 'bg-blue-600/30 blur-[110px]'
    : mode === 'loading'
      ? 'bg-blue-600/16 blur-[100px]'
      : 'bg-blue-600/20 blur-[120px]';

  const accentStrengthClass = mode === 'auth'
    ? 'bg-emerald-600/28 blur-[110px]'
    : mode === 'loading'
      ? 'bg-emerald-600/16 blur-[100px]'
      : 'bg-emerald-600/20 blur-[120px]';

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-slate-950">
      {/* Background Gradients */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full ${gradientStrengthClass}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${accentStrengthClass}`}></div>
      <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.24) 1px, transparent 0)', backgroundSize: '22px 22px' }}></div>
      
      {/* 3D Canvas (progressively enabled) */}
      {enableThree && (
        <Suspense fallback={null}>
          <div className="absolute inset-0">
            <ThreeFinanceScene />
          </div>
        </Suspense>
      )}
    </div>
  );
};

export default AnimatedBackground;
