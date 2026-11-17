"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { createClient } from "@/lib/supabase/client";
import { TOURS, tourForPath } from "@/lib/tours";

function visible(selector) {
  return [...document.querySelectorAll(`[data-tour="${selector}"]`)].find((node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

function sideFor(node) {
  const box = node.getBoundingClientRect();
  const middle = box.top + box.height / 2;
  if (window.innerWidth < 768) return middle > window.innerHeight * 0.55 ? "top" : "bottom";
  return middle > window.innerHeight * 0.7 ? "top" : "bottom";
}

async function remember(tourId) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  await supabase.from("user_tour_seen").upsert(
    { user_id: userId, tour_id: tourId, seen_at: new Date().toISOString() },
    { onConflict: "user_id,tour_id" },
  );
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
  if (error) return true;
  return Boolean(row);
}

export function startTour(tourId, { force = false } = {}) {
  window.dispatchEvent(new CustomEvent("wapifood-tour", { detail: { tourId, force } }));
}

export function TourGuide({ role }) {
  const pathname = usePathname();

  useEffect(() => {
    let active = null;
    let cancelled = false;

    async function run(tourId, force) {
      const tour = TOURS[tourId];
      if (!tour || !tour.roles.includes(role || "owner")) return;
      if (!force && (await alreadySeen(tourId))) return;
      if (cancelled) return;
      const steps = tour.steps
        .map((step) => {
          const element = visible(step.tour);
          if (!element) return null;
          return {
            element,
            disableActiveInteraction: step.interactive ? false : undefined,
            advanceOn: step.interactive ? "click" : undefined,
            popover: {
              title: step.title,
              description: step.interactive ? `${step.text} Toca lo iluminado para seguir.` : step.text,
              side: sideFor(element),
              align: "start",
              showButtons: step.interactive ? ["previous", "close"] : ["next", "previous", "close"],
            },
          };
        })
        .filter(Boolean);
      if (!steps.length) return;
      active?.destroy();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const guide = driver({
        animate: !reduce,
        overlayOpacity: 0.45,
        stagePadding: 8,
        stageRadius: 16,
        popoverOffset: 16,
        showProgress: true,
        progressText: "Paso {{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        doneBtnText: "Listo",
        closeBtnLabel: "Saltar",
        popoverClass: "wf-tour",
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = "Saltar";
          popover.previousButton.textContent = "Atrás";
          if (popover.nextButton.textContent !== "Listo") popover.nextButton.textContent = "Siguiente";
        },
        onDestroyed: () => {
          remember(tourId);
        },
        steps,
      });
      active = guide;
      guide.drive();
    }

    function onAsk(event) {
      const tourId = event.detail?.tourId || tourForPath(pathname, role);
      if (tourId) run(tourId, Boolean(event.detail?.force));
    }

    const timer = window.setTimeout(() => {
      const tourId = tourForPath(pathname, role);
      if (tourId) run(tourId, false);
    }, 700);
    window.addEventListener("wapifood-tour", onAsk);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("wapifood-tour", onAsk);
      active?.destroy();
    };
  }, [pathname, role]);

  return null;
}
