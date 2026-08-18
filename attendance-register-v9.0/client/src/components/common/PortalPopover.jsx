import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PortalPopover({ anchorRef, isOpen, onClose, children, width = 320, align = 'end', className = '', role = 'dialog' }) {
  const contentRef = useRef(null);
  const [style, setStyle] = useState({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef?.current) return undefined;

    const updatePosition = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const desiredWidth = Math.min(width, window.innerWidth - viewportPadding * 2);
      const contentHeight = contentRef.current?.getBoundingClientRect().height || 320;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const openAbove = spaceBelow < Math.min(contentHeight, 360) && rect.top > contentHeight + viewportPadding;
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - contentHeight - 8)
        : Math.min(rect.bottom + 8, window.innerHeight - viewportPadding - Math.min(contentHeight, window.innerHeight - viewportPadding * 2));
      const left = align === 'start' ? rect.left : rect.right - desiredWidth;
      setStyle({
        position: 'fixed',
        top,
        left: Math.max(viewportPadding, Math.min(left, window.innerWidth - desiredWidth - viewportPadding)),
        width: desiredWidth,
        maxHeight: `calc(100vh - ${viewportPadding * 2}px)`,
        overflowY: 'auto',
        zIndex: 'var(--z-popover, 1000)',
        visibility: 'visible',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, isOpen, width]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (anchorRef.current?.contains(event.target) || contentRef.current?.contains(event.target)) return;
      onClose?.();
    };
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen) return null;
  return createPortal(<div ref={contentRef} style={style} className={className} role={role}>{children}</div>, document.body);
}
