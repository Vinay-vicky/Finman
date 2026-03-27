import React from 'react';

const INRLoader = ({ label = 'Loading...', size = 'md', compact = false }) => {
  const sizeClass = size === 'sm' ? 'inr-loader--sm' : size === 'lg' ? 'inr-loader--lg' : 'inr-loader--md';

  return (
    <div className={`inr-loader-wrap ${compact ? 'inr-loader-wrap--compact' : ''}`} role="status" aria-live="polite" aria-label={label}>
      <div className={`inr-loader-coin ${sizeClass}`} aria-hidden="true">
        <div className="inr-loader-face inr-loader-face--front">₹</div>
        <div className="inr-loader-face inr-loader-face--back">₹</div>
        <div className="inr-loader-edge" />
      </div>
      {label ? <p className="inr-loader-label">{label}</p> : null}
    </div>
  );
};

export default INRLoader;
