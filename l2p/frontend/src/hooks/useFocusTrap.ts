import { useEffect, useRef } from 'react';

/**
 * Custom hook to trap focus within a modal or dialog
 *
 * Implements WCAG 2.1 Level AA requirement for focus management:
 * - Traps Tab navigation within the modal
 * - Shift+Tab navigates backwards
 * - Escape key closes the modal
 * - Returns focus to trigger element on close
 *
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Function to call when Escape is pressed
 * @returns Ref to attach to the modal container element
 */
export function useFocusTrap(isOpen: boolean, onClose?: () => void) {
  const containerRef = useRef<HTMLElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before the modal opened
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements within the modal
    const getFocusableElements = (): HTMLElement[] => {
      if (!container) return [];

      const focusableSelectors = [
        'a[href]',
        'area[href]',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
        .filter(element => {
          // Filter out invisible elements
          return element.offsetParent !== null &&
                 window.getComputedStyle(element).visibility !== 'hidden';
        });
    };

    // Focus the first focusable element when modal opens
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        focusableElements[0]?.focus();
      }, 10);
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Handle Tab key for focus trapping
      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement;

        // Shift+Tab on first element: go to last
        if (e.shiftKey && activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
        // Tab on last element: go to first
        else if (!e.shiftKey && activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Add event listener to the container
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the element that had focus before modal opened
      if (previouslyFocusedElement.current && document.body.contains(previouslyFocusedElement.current)) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  return containerRef;
}
