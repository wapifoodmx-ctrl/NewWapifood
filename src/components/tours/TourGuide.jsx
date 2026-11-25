"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { createClient } from "@/lib/supabase/client";
import { TOURS, homeTour, tourForPath } from "@/lib/tours";
import { fitTourPopover, pickTourElement, popoverSide } from "@/lib/tourTarget";

function remember(tourId) {
  const supabase = createClient();
  supabase.auth.getUser().then(({ data }) => {
    const userId = data.user?.id;
    if (!userId) return;
    supabase.from("user_tour_seen").upsert(
      { user_id: userId, tour_id: tourId, seen_at: new Date().toISOString() },
      { onConflict: "user_id,tour_id" },
    );
  });
}

async function alreadySeen(tourId) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return true;
  const { data: row, error } = await supabase
    .from("user_tour_seen")
    .select("tour_id")
    .eq("user_id", userId)
    .eq("tour_id", tourId)
    .maybeSingle();
  if (error) return false;
  return Boolean(row);
}

function placeCard(popover) {
  const card = popover?.wrapper;
  if (!card) return;
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  card.style.maxWidth = `${Math.max(160, width - 16)}px`;
  const placed = fitTourPopover(card, {
    width,
    height,
    bottomReserve: width < 1024 ? 88 : 0,
  });
  card.style.left = `${placed.left}px`;
  card.style.top = `${placed.top}px`;
  card.style.right = "auto";
  card.style.bottom = "auto";
}

export function startTour(tourId, { force = false } = {}) {
  window.dispatchEvent(new CustomEvent("wapifood-tour", { detail: { tourId, force } }));
}

export function TourGuide({ role }) {
  const pathname = usePathname();

  useEffect(() => {
    let active = null;
    let cancelled = false;
    let unlisten = () => {};

    async function run(tourId, force) {
      const tour = TOURS[tourId];
      if (!tour || !tour.roles.includes(role || "owner")) return;
      if (!force && (await alreadySeen(tourId))) return;
      if (cancelled) return;

      const steps = tour.steps.map((step) => {
        const element = () => pickTourElement(step.tour);
        const sample = element();
        return {
          element,
          // Sin `instruction`: en driver 1.14 eso bloquea Siguiente hasta que
          // el toque cae en el hueco, y en varios teléfonos ese toque no cae.
          disableActiveInteraction: !step.interactive,
          advanceOn: step.interactive ? "click" : undefined,
          popover: {
            title: step.title,
            description: step.interactive
              ? `${step.text} Toca lo iluminado para seguir, o Siguiente.`
              : `${step.text} Toca Siguiente.`,
            side: sample ? popoverSide(sample.getBoundingClientRect(), {
              width: window.innerWidth,
              height: window.visualViewport?.height || window.innerHeight,
            }) : "bottom",
            align: "center",
          },
        };
      });

      active?.destroy();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const guide = driver({
        animate: !reduce,
        smoothScroll: false,
        overlayOpacity: 0.45,
        stagePadding: 10,
        stageRadius: 16,
        popoverOffset: 12,
        showProgress: true,
        progressText: "Paso {{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        doneBtnText: "Listo",
        closeBtnLabel: "Saltar",
        allowClose: true,
        // Un toque en lo oscuro no cierra: en el teléfono se iba y quedaba marcada como vista.
        overlayClickBehavior: "none",
        popoverClass: "wf-tour",
        waitForElement: 1200,
        onElementMissing: (_element, _step, opts) => {
          if (opts.driver.hasNextStep()) opts.driver.moveNext();
          else opts.driver.destroy();
          return false;
        },
        onInteraction: (_element, step, opts) => {
          if (opts.event?.type !== "click" || opts.region === "popover") return;
          if (opts.region === "element" && step?.advanceOn) return;
          opts.driver.nudge(
            opts.region === "element"
              ? "Toca Siguiente para seguir."
              : "Toca la zona iluminada, o Siguiente.",
          );
          return false;
        },
        onPopoverPositioned: (popover) => {
          placeCard(popover);
        },
        onDestroyed: (_element, _step, opts) => {
          const reason = opts?.reason;
          if (reason === "done" || reason === "close" || reason === "overlay" || reason === "escape") {
            remember(tourId);
          }
        },
        steps,
      });
      active = guide;
      const refresh = () => {
        if (guide.isActive()) guide.refresh();
      };
      window.visualViewport?.addEventListener("resize", refresh);
      window.visualViewport?.addEventListener("scroll", refresh);
      window.addEventListener("orientationchange", refresh);
      unlisten = () => {
        window.visualViewport?.removeEventListener("resize", refresh);
        window.visualViewport?.removeEventListener("scroll", refresh);
        window.removeEventListener("orientationchange", refresh);
      };
      guide.drive();
    }

    function onAsk(event) {
      const tourId = event.detail?.tourId || tourForPath(pathname, role);
      if (tourId) run(tourId, Boolean(event.detail?.force));
    }

    const timer = window.setTimeout(async () => {
      const hello = homeTour(pathname, role);
      if (hello && !(await alreadySeen(hello))) {
        run(hello, false);
        return;
      }
      const tourId = tourForPath(pathname, role);
      if (tourId && tourId !== hello) run(tourId, false);
    }, 700);

    window.addEventListener("wapifood-tour", onAsk);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("wapifood-tour", onAsk);
      unlisten();
      active?.destroy();
    };
  }, [pathname, role]);

  return null;
}
