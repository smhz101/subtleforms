/**
 * Notice Provider
 *
 * Centralized notice/toast management.
 */

import { createContext, useContext, useState, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { normalizeError, getUserFriendlyMessage } from './normalizeError';

const NoticeContext = createContext(null);

export function NoticeProvider({ children }) {
  const [notices, setNotices] = useState([]);

  const addNotice = useCallback((notice) => {
    const id = `notice-${Date.now()}-${Math.random()}`;
    const newNotice = {
      id,
      type: 'info',
      dismissible: true,
      duration: 5000,
      ...notice,
    };

    setNotices((prev) => [...prev, newNotice]);

    if (newNotice.duration && newNotice.dismissible) {
      setTimeout(() => {
        removeNotice(id);
      }, newNotice.duration);
    }

    return id;
  }, []);

  const removeNotice = useCallback((id) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotices = useCallback(() => {
    setNotices([]);
  }, []);

  const success = useCallback((message, options = {}) => {
    return addNotice({ type: 'success', message, ...options });
  }, [addNotice]);

  const error = useCallback((errorOrMessage, options = {}) => {
    const message = typeof errorOrMessage === 'string'
      ? errorOrMessage
      : getUserFriendlyMessage(errorOrMessage);
    
    return addNotice({ 
      type: 'error', 
      message, 
      duration: 8000,
      ...options 
    });
  }, [addNotice]);

  const warning = useCallback((message, options = {}) => {
    return addNotice({ type: 'warning', message, ...options });
  }, [addNotice]);

  const info = useCallback((message, options = {}) => {
    return addNotice({ type: 'info', message, ...options });
  }, [addNotice]);

  const value = {
    notices,
    addNotice,
    removeNotice,
    clearNotices,
    success,
    error,
    warning,
    info,
  };

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <NoticeList notices={notices} onDismiss={removeNotice} />
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error('useNotice must be used within NoticeProvider');
  }
  return context;
}

function NoticeList({ notices, onDismiss }) {
  if (notices.length === 0) return null;

  return (
    <div className="sf-notice-container">
      {notices.map((notice) => (
        <Notice key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Notice({ notice, onDismiss }) {
  const typeStyles = {
    success: 'sf-notice--success',
    error: 'sf-notice--error',
    warning: 'sf-notice--warning',
    info: 'sf-notice--info',
  };

  return (
    <div className={`sf-notice ${typeStyles[notice.type] || ''}`}>
      <div className="sf-notice__content">
        <p className="sf-notice__message">{notice.message}</p>
      </div>
      {notice.dismissible && (
        <button
          type="button"
          className="sf-notice__dismiss"
          onClick={() => onDismiss(notice.id)}
          aria-label={__('Dismiss notice', 'subtleforms')}
        >
          ×
        </button>
      )}
    </div>
  );
}
