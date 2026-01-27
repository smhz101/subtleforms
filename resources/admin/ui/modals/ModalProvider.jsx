/**
 * Modal Provider
 *
 * Centralized modal orchestration with accessibility and stacking control.
 */

import { createContext, useContext, useState, useCallback, useEffect } from '@wordpress/element';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modals, setModals] = useState([]);

  const openModal = useCallback((id, props = {}) => {
    setModals((prev) => {
      // Prevent duplicates
      if (prev.some(m => m.id === id)) {
        return prev;
      }
      return [...prev, { id, props, timestamp: Date.now() }];
    });
  }, []);

  const closeModal = useCallback((id) => {
    setModals((prev) => prev.filter(m => m.id !== id));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals([]);
  }, []);

  const updateModalProps = useCallback((id, props) => {
    setModals((prev) => prev.map(m => 
      m.id === id ? { ...m, props: { ...m.props, ...props } } : m
    ));
  }, []);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (modals.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [modals.length]);

  const value = {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    updateModalProps,
    activeModal: modals[modals.length - 1] || null,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}
