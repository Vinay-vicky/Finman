import React from 'react';
import { useRenderProfile } from '../utils/renderProfile';

const INRLoader = ({ label = 'Loading...', size = 'md', compact = false, variant = 'auto' }) => {
  const profile = useRenderProfile();
  const sizeClass = size === 'sm' ? 'inr-loader--sm' : size === 'lg' ? 'inr-loader--lg' : 'inr-loader--md';
  const useEnhanced = variant === 'enhanced' || (variant === 'auto' && profile.allowEnhancedLoader && !compact);

  return (
    <div className={`inr-loader-wrap ${compact ? 'inr-loader-wrap--compact' : ''}`} role="status" aria-live="polite" aria-label={label}>
      <div className={`inr-loader-coin ${sizeClass} ${useEnhanced ? 'inr-loader-coin--enhanced' : ''}`} aria-hidden="true">
        <div className="inr-loader-face inr-loader-face--front">₹</div>
        <div className="inr-loader-face inr-loader-face--back">₹</div>
        <div className="inr-loader-edge" />
        {useEnhanced && <div className="inr-loader-ring" />}
      </div>
      {label ? <p className="inr-loader-label">{label}</p> : null}
    </div>
  );
};

export default INRLoader;
