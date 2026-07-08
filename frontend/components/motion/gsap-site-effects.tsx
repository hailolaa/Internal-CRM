"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { gsap } from "gsap";

const REVEAL_SELECTOR = [
  "[data-gsap-reveal]",
  "main h1",
  "main h2",
  "main .surface-card",
  "main .surface-warm",
  "main .surface-stone",
  "main [class*='rounded-2xl']",
  "main [class*='rounded-[24px]']",
].join(",");

const INTERACTIVE_SELECTOR = [
  "main button:not(:disabled)",
  "main a[href]",
  "[data-gsap-interactive]",
].join(",");

const SURFACE_SELECTOR = [
  "main .surface-card",
  "main .surface-warm",
  "main .surface-stone",
  "main [class*='shadow-sm']",
  "main [class*='shadow-card']",
].join(",");

const POPOVER_SELECTOR = [
  "[data-gsap-popover]",
  "[data-sonner-toast]",
].join(",");

const LIST_ITEM_SELECTOR = [
  "[data-gsap-list-item]",
  "[data-gsap-nav-item]",
].join(",");

const OVERLAY_SELECTOR = "[data-gsap-overlay]";
const METRIC_SELECTOR = "[data-gsap-metric]";
const OUTPUT_SELECTOR = "[data-gsap-output]";
const STEP_SELECTOR = "[data-gsap-step]";
const MAX_INTERACTIVE_ELEMENTS = 120;
const MAX_SURFACE_ELEMENTS = 80;

const animatedNodes = new WeakSet<HTMLElement>();

function uniqueElements(elements: Element[]) {
  return Array.from(new Set(elements)).filter((element) => {
    return element instanceof HTMLElement && element.offsetParent !== null;
  }) as HTMLElement[];
}

function hasReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markAnimated(element: HTMLElement) {
  if (animatedNodes.has(element)) return false;
  animatedNodes.add(element);
  return true;
}

export function GsapSiteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (hasReducedMotion()) return;

    const scope = document.querySelector("[data-gsap-scope]") || document.body;
    const revealElements = uniqueElements(
      Array.from(scope.querySelectorAll(REVEAL_SELECTOR)),
    ).slice(0, 28);

    if (revealElements.length === 0) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        revealElements,
        {
          autoAlpha: 0,
          filter: "blur(10px)",
          y: 18,
        },
        {
          autoAlpha: 1,
          clearProps: "filter,transform,visibility,opacity",
          duration: 0.62,
          ease: "power3.out",
          filter: "blur(0px)",
          stagger: {
            amount: 0.22,
            from: "start",
          },
          y: 0,
        },
      );
    }, scope);

    return () => context.revert();
  }, [pathname]);

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (hasReducedMotion() || !canHover.matches) return;

    const scope = document.querySelector("[data-gsap-scope]") || document.body;
    const interactiveElements = uniqueElements(
      Array.from(scope.querySelectorAll(INTERACTIVE_SELECTOR)),
    ).slice(0, MAX_INTERACTIVE_ELEMENTS);
    const surfaceElements = uniqueElements(
      Array.from(scope.querySelectorAll(SURFACE_SELECTOR)),
    ).slice(0, MAX_SURFACE_ELEMENTS);

    if (interactiveElements.length === 0 && surfaceElements.length === 0) {
      return;
    }

    const cleanups: Array<() => void> = [];

    interactiveElements.forEach((element) => {
      const enter = () => {
        gsap.to(element, {
          duration: 0.22,
          ease: "power2.out",
          scale: 1.018,
          y: -1,
        });
      };
      const leave = () => {
        gsap.to(element, {
          clearProps: "transform",
          duration: 0.28,
          ease: "power2.out",
          scale: 1,
          y: 0,
        });
      };
      const down = () => {
        gsap.to(element, {
          duration: 0.08,
          ease: "power1.out",
          scale: 0.985,
          y: 0,
        });
      };

      element.addEventListener("pointerenter", enter);
      element.addEventListener("pointerleave", leave);
      element.addEventListener("pointerdown", down);
      element.addEventListener("pointerup", leave);
      cleanups.push(() => {
        element.removeEventListener("pointerenter", enter);
        element.removeEventListener("pointerleave", leave);
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("pointerup", leave);
      });
    });

    surfaceElements.forEach((element) => {
      const enter = () => {
        gsap.to(element, {
          boxShadow: "0 16px 38px rgba(21, 31, 33, 0.10)",
          duration: 0.28,
          ease: "power2.out",
          y: -2,
        });
      };
      const leave = () => {
        gsap.to(element, {
          clearProps: "boxShadow,transform",
          duration: 0.32,
          ease: "power2.out",
          y: 0,
        });
      };

      element.addEventListener("pointerenter", enter);
      element.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        element.removeEventListener("pointerenter", enter);
        element.removeEventListener("pointerleave", leave);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      const animatedElements = [...interactiveElements, ...surfaceElements];
      if (animatedElements.length > 0) gsap.killTweensOf(animatedElements);
    };
  }, [pathname]);

  useEffect(() => {
    if (hasReducedMotion()) return;

    const shellElements = uniqueElements(
      Array.from(document.querySelectorAll("[data-gsap-shell]")),
    );
    const navItems = uniqueElements(
      Array.from(document.querySelectorAll("[data-gsap-nav-item]")),
    ).slice(0, 42);

    const context = gsap.context(() => {
      if (shellElements.length > 0) {
        shellElements.forEach((element) => animatedNodes.add(element));
        gsap.fromTo(
          shellElements,
          { autoAlpha: 0, y: -8 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.42,
            ease: "power2.out",
            stagger: 0.04,
            y: 0,
          },
        );
      }

      if (navItems.length > 0) {
        navItems.forEach((element) => animatedNodes.add(element));
        gsap.fromTo(
          navItems,
          { autoAlpha: 0, x: -10 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.38,
            ease: "power2.out",
            stagger: 0.012,
            x: 0,
          },
        );
      }
    });

    return () => context.revert();
  }, []);

  useEffect(() => {
    if (hasReducedMotion()) return;

    function animateNewNodes(root: ParentNode) {
      const overlays = uniqueElements(
        Array.from(root.querySelectorAll(OVERLAY_SELECTOR)),
      ).slice(0, 12).filter(markAnimated);
      const popovers = uniqueElements(
        Array.from(root.querySelectorAll(POPOVER_SELECTOR)),
      ).slice(0, 12).filter(markAnimated);
      const listItems = uniqueElements(
        Array.from(root.querySelectorAll(LIST_ITEM_SELECTOR)),
      ).slice(0, 80).filter(markAnimated);
      const metrics = uniqueElements(
        Array.from(root.querySelectorAll(METRIC_SELECTOR)),
      ).slice(0, 24).filter(markAnimated);
      const outputs = uniqueElements(
        Array.from(root.querySelectorAll(OUTPUT_SELECTOR)),
      ).slice(0, 16).filter(markAnimated);
      const steps = uniqueElements(
        Array.from(root.querySelectorAll(STEP_SELECTOR)),
      ).slice(0, 32).filter(markAnimated);

      if (overlays.length > 0) {
        gsap.fromTo(
          overlays,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            clearProps: "opacity,visibility",
            duration: 0.22,
            ease: "power1.out",
          },
        );
      }

      if (popovers.length > 0) {
        gsap.fromTo(
          popovers,
          { autoAlpha: 0, scale: 0.985, y: -10 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.34,
            ease: "power3.out",
            scale: 1,
            y: 0,
          },
        );
      }

      if (listItems.length > 0) {
        gsap.fromTo(
          listItems,
          { autoAlpha: 0, x: -8 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.32,
            ease: "power2.out",
            stagger: {
              amount: Math.min(0.16, listItems.length * 0.018),
              from: "start",
            },
            x: 0,
          },
        );
      }

      if (metrics.length > 0) {
        gsap.fromTo(
          metrics,
          { autoAlpha: 0, scale: 0.96, y: 12 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.48,
            ease: "back.out(1.45)",
            scale: 1,
            stagger: {
              amount: Math.min(0.18, metrics.length * 0.025),
              from: "start",
            },
            y: 0,
          },
        );
      }

      if (outputs.length > 0) {
        gsap.fromTo(
          outputs,
          { autoAlpha: 0, filter: "blur(8px)", y: 16 },
          {
            autoAlpha: 1,
            clearProps: "filter,opacity,transform,visibility",
            duration: 0.58,
            ease: "power3.out",
            filter: "blur(0px)",
            stagger: 0.04,
            y: 0,
          },
        );
      }

      if (steps.length > 0) {
        gsap.fromTo(
          steps,
          { autoAlpha: 0, x: 18 },
          {
            autoAlpha: 1,
            clearProps: "opacity,transform,visibility",
            duration: 0.42,
            ease: "power2.out",
            stagger: 0.035,
            x: 0,
          },
        );
      }
    }

    animateNewNodes(document);

    const pendingRoots = new Set<ParentNode>();
    let animationFrame = 0;

    const flushPendingRoots = () => {
      animationFrame = 0;
      pendingRoots.forEach((root) => animateNewNodes(root));
      pendingRoots.clear();
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          pendingRoots.add(node.parentElement || node);
        });
      });

      if (!animationFrame && pendingRoots.size > 0) {
        animationFrame = window.requestAnimationFrame(flushPendingRoots);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      pendingRoots.clear();
    };
  }, []);

  return null;
}
