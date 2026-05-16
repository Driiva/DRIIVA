// Helper to fire the IntersectionObserver mock callback for tests.
export function fireIntersect(target?: Element, isIntersecting = true): void {
  const Mock = (globalThis as unknown as {
    __IOMock: {
      instances: Array<{
        callback: IntersectionObserverCallback;
      }>;
    };
  }).__IOMock;
  if (!Mock) return;
  for (const inst of Mock.instances) {
    inst.callback(
      [
        {
          isIntersecting,
          target: target ?? document.body,
          intersectionRatio: isIntersecting ? 1 : 0,
          time: performance.now(),
          rootBounds: null,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ],
      inst as unknown as IntersectionObserver,
    );
  }
}

export function resetIOInstances(): void {
  const Mock = (globalThis as unknown as { __IOMock: { instances: unknown[] } }).__IOMock;
  if (Mock) Mock.instances.length = 0;
}
