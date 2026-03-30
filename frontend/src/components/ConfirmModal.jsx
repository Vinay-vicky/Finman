import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  const modalRef = useRef(null);

  useGSAP(() => {
    if (!isOpen) return;
    gsap.fromTo(
      '.confirm-modal-panel',
      { opacity: 0, y: 16, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'power2.out' }
    );
  }, { scope: modalRef, dependencies: [isOpen] });

  if (!isOpen) return null;
  
  return (
    <div ref={modalRef} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="glass-panel confirm-modal-panel" style={{ width: '90%', maxWidth: '400px', margin: 'auto' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>{message}</p>
        
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button 
            className="btn" 
            style={{ background: 'var(--panel-bg)', width: 'auto', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="btn" 
            style={{ background: 'var(--danger)', width: 'auto' }} 
            onClick={onConfirm}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
