/**
 * useInsertPicker.js
 * 
 * Manages the field insert picker popover state
 * Extracted from FormEditor.jsx for better separation of concerns
 */

import { useState, useCallback } from '@wordpress/element';

/**
 * Custom hook for insert picker state management
 * 
 * @returns {Object} Insert picker state and handlers
 */
export function useInsertPicker() {
  const [insertPicker, setInsertPicker] = useState(null);

  const handleRequestInsert = useCallback((context, anchor) => {
    setInsertPicker({ context, anchor });
  }, []);

  const handleCloseInsert = useCallback(() => {
    setInsertPicker(null);
  }, []);

  return {
    insertPicker,
    setInsertPicker,
    handleRequestInsert,
    handleCloseInsert,
  };
}
