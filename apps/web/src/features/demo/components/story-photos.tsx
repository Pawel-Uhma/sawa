"use client";

import type { PlacePhoto } from "@sawa/shared";
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/features/i18n";
import { usePlace } from "@/features/map";
import { haptic, project, SPRING, SPRING_FLICK } from "../lib/device";
import { photoCredit, showablePhotos, thumbnailUrl } from "../lib/photos";
import { CloseIcon } from "./icons";

/*
 * Zdjęcia miejsca przy opowieści Sawy: pasek miniatur (przewijany w bok, gdy jest ich więcej),
 * pod każdą rok, autor i licencja. Stuknięcie powiększa zdjęcie: wyrasta z miniatury sprężyną,
 * a zamknięte (stuknięciem, Esc albo zrzuceniem w dół) wraca na swoje miejsce.
 * Szczegóły miejsca bierze z tego samego zapytania co podgląd i karta (usePlace, w pamięci).
 */

// Miniatury mają stałe proporcje, więc ładujące się zdjęcie nie przesuwa tekstu
const THUMB = "h-[88px] w-[118px]";
// Zrzut w dół zamyka powiększenie, gdy zdjęcie zatrzymałoby się dalej niż tyle pikseli
const DISMISS_PX = 140;

type Opened = { photo: PlacePhoto; from: DOMRect; trigger: HTMLElement };

export function StoryPhotos({
  placeId,
  name,
  className = "",
}: {
  placeId: string;
  name: string;
  className?: string;
}) {
  const t = useT();
  const detail = usePlace(placeId);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [opened, setOpened] = useState<Opened | null>(null);
  const photos = useMemo(
    () => showablePhotos(detail.data?.photos ?? []).filter((photo) => !failed.has(photo.url)),
    [detail.data, failed],
  );
  if (photos.length === 0) return null;

  return (
    <>
      <ul
        aria-label={t("Zdjęcia miejsca", "Photos of the place")}
        className={`flex touch-pan-x touch-pan-y snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {photos.map((photo) => (
          <li key={photo.url} className="w-[118px] shrink-0 snap-start">
            <button
              type="button"
              aria-label={t(
                `Powiększ zdjęcie: ${photo.caption ?? name}`,
                `Enlarge photo: ${photo.caption ?? name}`,
              )}
              onClick={(event) => {
                haptic();
                const trigger = event.currentTarget;
                setOpened({ photo, from: trigger.getBoundingClientRect(), trigger });
              }}
              className={`relative block overflow-hidden rounded-2xl bg-tlo-2 transition-transform duration-100 active:scale-[0.96] ${THUMB}`}
            >
              <Thumb
                photo={photo}
                alt={photo.caption ?? name}
                hidden={opened?.photo.url === photo.url}
                onError={() => setFailed((prev) => new Set(prev).add(photo.url))}
              />
            </button>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-tekst-3">
              {photoCredit(photo)}
            </p>
          </li>
        ))}
      </ul>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {opened && (
              <Lightbox
                key={opened.photo.url}
                opened={opened}
                name={name}
                onClose={() => setOpened(null)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Thumb({
  photo,
  alt,
  hidden,
  onError,
}: {
  photo: PlacePhoto;
  alt: string;
  hidden: boolean;
  onError: () => void;
}) {
  const [ready, setReady] = useState(false);
  return (
    <>
      {!ready && <span aria-hidden="true" className="szkielet absolute inset-0" />}
      {/* biome-ignore lint/performance/noImgElement: zdjęcia z wielu archiwów, next/image wymagałby każdej domeny w konfiguracji */}
      <img
        ref={(img) => {
          // Zdjęcie z pamięci podręcznej bywa gotowe przed podpięciem onLoad
          if (img?.complete && img.naturalWidth > 0 && !ready) setReady(true);
        }}
        src={thumbnailUrl(photo.url)}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setReady(true)}
        onError={onError}
        className={`size-full object-cover transition-opacity duration-300 ease-out ${
          ready && !hidden ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

/** Pełne zdjęcie nad wszystkim; startuje z miejsca i rozmiaru miniatury, więc „wyrasta” z niej. */
function Lightbox({
  opened,
  name,
  onClose,
}: {
  opened: Opened;
  name: string;
  onClose: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { photo, from, trigger } = opened;
  const credit = photoCredit(photo);

  // Przesunięcie i skala, które kładą zdjęcie na miniaturze (szerokość docelowa jak w klasie niżej)
  const origin = useMemo(() => {
    if (typeof window === "undefined") return { x: 0, y: 0, scale: 0.4 };
    const width = Math.min(window.innerWidth - 32, 960);
    return {
      x: from.left + from.width / 2 - window.innerWidth / 2,
      y: from.top + from.height / 2 - window.innerHeight / 2,
      scale: from.width / width,
    };
  }, [from]);
  const hidden = reduce ? { opacity: 0 } : { ...origin, opacity: 0 };

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger.focus({ preventScroll: true });
    };
  }, [onClose, trigger]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.y + project(info.velocity.y, 0.99)) > DISMISS_PX) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? name}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <motion.button
        type="button"
        aria-label={t("Zamknij zdjęcie", "Close photo")}
        tabIndex={-1}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        className="absolute inset-0 cursor-default bg-black/88"
      />
      <motion.figure
        initial={hidden}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        exit={hidden}
        transition={SPRING_FLICK}
        drag={reduce ? false : "y"}
        dragSnapToOrigin
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        onClick={onClose}
        className="relative flex w-full max-w-[960px] cursor-grab flex-col items-center gap-3 active:cursor-grabbing"
      >
        {/* biome-ignore lint/performance/noImgElement: zdjęcia z wielu archiwów, next/image wymagałby każdej domeny w konfiguracji */}
        <img
          src={photo.url}
          alt={photo.caption ?? name}
          referrerPolicy="no-referrer"
          draggable={false}
          className="max-h-[72dvh] w-full rounded-2xl object-contain"
        />
        <figcaption className="w-full text-center text-white">
          {photo.caption && (
            <p className="text-[15px] font-semibold leading-snug">{photo.caption}</p>
          )}
          {credit && <p className="mt-1 text-xs text-white/70">{credit}</p>}
          {photo.pageUrl && (
            <a
              href={photo.pageUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-1 inline-block rounded-full px-2 py-1 text-xs font-bold text-white/85 underline"
            >
              {t("Źródło zdjęcia", "Photo source")}
            </a>
          )}
        </figcaption>
      </motion.figure>
      <motion.button
        ref={closeRef}
        type="button"
        aria-label={t("Zamknij", "Close")}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-100 active:scale-[0.92]"
      >
        <CloseIcon className="size-5" />
      </motion.button>
    </div>
  );
}
