import { useState, useEffect, useCallback, type ComponentType } from 'react';
import { useLocation } from 'wouter';

interface PageConfig {
  path: string;
  component: ComponentType;
  name: string;
}

export function useInfiniteScroll(pages: PageConfig[]) {
  const [location, setLocation] = useLocation();
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Find current page index
  useEffect(() => {
    const currentIndex = pages.findIndex(page => page.path === location);
    if (currentIndex !== -1) {
      setCurrentPageIndex(currentIndex);
    }
  }, [location, pages]);

  // Handle wheel scroll navigation
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const scrollThreshold = 50;
    if (Math.abs(e.deltaY) < scrollThreshold) return;

    if (e.deltaY > 0) {
      // Scroll down - go to next page
      const nextIndex = (currentPageIndex + 1) % pages.length;
      setDirection('right');
      setLocation(pages[nextIndex].path);
    } else {
      // Scroll up - go to previous page
      const prevIndex = currentPageIndex === 0 ? pages.length - 1 : currentPageIndex - 1;
      setDirection('left');
      setLocation(pages[prevIndex].path);
    }
  }, [currentPageIndex, pages, setLocation]);

  // Handle touch swipe navigation
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Swipe left - go to next page
      const nextIndex = (currentPageIndex + 1) % pages.length;
      setDirection('right');
      setLocation(pages[nextIndex].path);
    } else if (isRightSwipe) {
      // Swipe right - go to previous page
      const prevIndex = currentPageIndex === 0 ? pages.length - 1 : currentPageIndex - 1;
      setDirection('left');
      setLocation(pages[prevIndex].path);
    }
  };

  // Add event listeners
  useEffect(() => {
    const element = document.documentElement;
    
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel]);

  return {
    direction,
    currentPageIndex,
    currentPage: pages[currentPageIndex]
  };
}