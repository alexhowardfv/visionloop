'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setPositioned(false);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setPositioned(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const triggerCenterY = triggerRect.top + triggerRect.height / 2;

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = triggerCenterX - tooltipRect.width / 2;
          y = triggerRect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          x = triggerCenterX - tooltipRect.width / 2;
          y = triggerRect.bottom + 8;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8;
          y = triggerCenterY - tooltipRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerCenterY - tooltipRect.height / 2;
          break;
      }

      // Clamp to viewport
      const clampedX = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
      const clampedY = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));

      // Calculate arrow offset so it still points at the trigger center
      if (position === 'top' || position === 'bottom') {
        setArrowOffset(triggerCenterX - (clampedX + tooltipRect.width / 2));
      } else {
        setArrowOffset(triggerCenterY - (clampedY + tooltipRect.height / 2));
      }

      setCoords({ x: clampedX, y: clampedY });
      setPositioned(true);
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getArrowStyle = (): React.CSSProperties => {
    if (position === 'top' || position === 'bottom') {
      return { left: `calc(50% + ${arrowOffset}px)`, transform: 'translateX(-50%) rotate(45deg)' };
    }
    return { top: `calc(50% + ${arrowOffset}px)`, transform: 'translateY(-50%) rotate(45deg)' };
  };

  const getArrowPositionClass = () => {
    switch (position) {
      case 'top':
        return '-bottom-1';
      case 'bottom':
        return '-top-1';
      case 'left':
        return '-right-1';
      case 'right':
        return '-left-1';
      default:
        return '';
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={`inline-flex ${className || ''}`}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-3 py-2 text-xs font-medium text-white bg-primary-lighter rounded-lg shadow-elevated border border-border/50 whitespace-nowrap transition-opacity duration-75 ${
            positioned ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            left: coords.x,
            top: coords.y,
          }}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-primary-lighter ${getArrowPositionClass()}`}
            style={getArrowStyle()}
          />
        </div>
      )}
    </>
  );
};
