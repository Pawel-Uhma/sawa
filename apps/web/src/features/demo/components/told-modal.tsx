"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useLang, useT } from "@/features/i18n";
import { useSelectedPlace } from "@/features/map";
import { haptic, SPRING } from "../lib/device";
import { formatWhen } from "../lib/format";
import { forgetAll, toldNewestFirst, useMemory } from "../lib/memory";
import { ChevronRightIcon, CloseIcon, PinIcon } from "./icons";

// „Co już Ci opowiedziałam” z menu: miejsca od najnowszego. Stuknięcie w miejsce zamyka modal
// i zaznacza je na mapie (`?p=`), a karta miejsca i kamera robią resztę.

type ToldModalProps = {
  open: boolean;
  onClose: () => void;
  /** Przed zaznaczeniem: powrót na ekran mapy, bo karta miejsca żyje tylko tam. */
  onShowPlace: () => void;
};

export function ToldModal({ open, onClose, onShowPlace }: ToldModalProps) {
  return (
    <AnimatePresence>
      {open && <ToldDialog key="told" onClose={onClose} onShowPlace={onShowPlace} />}
    </AnimatePresence>
  );
}

function ToldDialog({ onClose, onShowPlace }: Omit<ToldModalProps, "open">) {
  const reduce = useReducedMotion();
  const t = useT();
  const lang = useLang();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const memory = useMemory();
  const told = toldNewestFirst(memory);
  const { select } = useSelectedPlace();
  // Zapomnienie jest nieodwracalne, więc pierwsze stuknięcie tylko pyta (bez okna dialogowego).
  const [confirmForget, setConfirmForget] = useState(false);
  const forgetTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(forgetTimer.current);
    };
  }, [onClose]);

  function show(id: string) {
    haptic();
    onShowPlace();
    select(id);
    onClose();
  }

  function forget() {
    haptic();
    window.clearTimeout(forgetTimer.current);
    if (!confirmForget) {
      setConfirmForget(true);
      forgetTimer.current = window.setTimeout(() => setConfirmForget(false), 3000);
      return;
    }
    setConfirmForget(false);
    forgetAll();
  }

  const fade = { opacity: 0 };
  const rise = reduce ? fade : { opacity: 0, y: 40 };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-2 md:items-center md:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#102b2a]/35"
        initial={fade}
        animate={{ opacity: 1 }}
        exit={fade}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={rise}
        animate={{ opacity: 1, y: 0 }}
        exit={rise}
        transition={SPRING}
        className="karta relative flex max-h-[85dvh] w-full max-w-md flex-col gap-4 rounded-[34px] bg-powierzchnia! p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none md:p-6"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]"
            >
              {t("Co już Ci opowiedziałam", "What I've already told you")}
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-tekst-2">
              {told.length === 0
                ? t(
                    "Jeszcze nic. Po pierwszej opowieści zobaczysz tu miejsca, o których mówiłam, i kiedy.",
                    "Nothing yet. After the first story you'll see here the places I talked about, and when.",
                  )
                : t(
                    "Od najnowszych. Stuknij miejsce, żeby zobaczyć je na mapie.",
                    "Newest first. Tap a place to see it on the map.",
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Zamknij", "Close")}
            className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-tekst-2 transition-[background-color,transform] duration-100 hover:bg-tlo-2 active:scale-90"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        {told.length > 0 && (
          <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {told.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => show(place.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[18px] px-2 py-2.5 text-left transition-colors duration-100 active:bg-tekst/[0.06] md:hover:bg-tekst/[0.04]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-tlo-2 text-glebia">
                    <PinIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold leading-tight text-tekst">
                      {place.name ?? t("Miejsce z trasy", "A place on the route")}
                    </span>
                    <time
                      dateTime={new Date(place.at).toISOString()}
                      className="mt-0.5 block text-[13px] leading-tight text-tekst-2 tabular-nums"
                    >
                      {formatWhen(place.at, Date.now(), lang)}
                    </time>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-tekst-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {told.length > 0 && (
          <button
            type="button"
            onClick={forget}
            className="flex h-12 shrink-0 items-center justify-center rounded-[18px] text-[15px] font-bold text-koral transition-colors duration-100 active:bg-koral/10 md:hover:bg-koral/10"
          >
            {confirmForget
              ? t("Stuknij jeszcze raz, żeby zapomnieć", "Tap again to forget")
              : t("Zapomnij wszystko", "Forget everything")}
          </button>
        )}
      </motion.div>
    </div>
  );
}
