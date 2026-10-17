"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ComponentType,
  createContext,
  type ReactNode,
  type SVGProps,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type Lang, LangSwitch, pick, useLang, useT } from "@/features/i18n";
import { ThemeSwitch } from "@/features/theme";
import { haptic, project, SPRING, SPRING_FLICK, useIsDesktop } from "../lib/device";
import { rubberband, useVerticalDrag } from "../lib/gesture";
import {
  AUDIENCES,
  type Choice,
  FAMILIARITY,
  INTERESTS,
  type Profile,
  STORY_STYLES,
} from "../lib/onboarding";
import { setMusicOn, useMusicOn } from "../lib/ride-music-player";
import type { StartMode } from "../lib/start-point";
import { topicStyle } from "../lib/topic-style";
import {
  BubbleIcon,
  ChevronRightIcon,
  CompassIcon,
  InfoIcon,
  ListenerIcon,
  LocateIcon,
  MusicIcon,
  PinIcon,
  RestartIcon,
  RoutesIcon,
  ShareIcon,
  SparkIcon,
} from "./icons";
import { Logo, SawaHead } from "./logo";
import type { ProfileStep } from "./profile-modal";

export type SawaMenuActions = {
  profile: Profile;
  /** Otwiera modal edycji jednego pola (nie onboarding). */
  onEditProfile: (step: ProfileStep) => void;
  /** Liczba opowieści w ostatniej trasie; null, gdy jeszcze żadnej nie było. */
  lastRouteStops: number | null;
  onOpenLastRoute: () => void;
  /** Gotowe przejażdżki z okolicy (dawna zakładka w pasku). */
  onOpenRides: () => void;
  /** Ekran Sawy: co mówi teraz i o czym już opowiedziała (dawna zakładka w pasku). */
  onOpenSawa: () => void;
  onRestart: () => void;
  /** Ile miejsc Sawa już opowiedziała temu słuchaczowi (lib/memory.ts). */
  rememberedPlaces: number;
  /** Lista opowiedzianych miejsc od najnowszego (told-modal.tsx). */
  onOpenTold: () => void;
  /** Skąd rusza przejażdżka (lib/start-point.ts) i podpis tego, co naprawdę jest startem. */
  startMode: StartMode;
  startLabel: string;
  onStartModeChange: (mode: StartMode) => void;
};

const SawaMenuContext = createContext<SawaMenuActions | null>(null);

export function SawaMenuProvider({
  value,
  children,
}: {
  value: SawaMenuActions;
  children: ReactNode;
}) {
  return <SawaMenuContext.Provider value={value}>{children}</SawaMenuContext.Provider>;
}

// Popover na desktopie: szybsza sprężyna niż arkusz, bo przebywa krótszą drogę.
const POPOVER_SPRING = { type: "spring", bounce: 0, duration: 0.32 } as const;

type SawaMenuButtonProps = {
  /** „badge”: szklane kółko z głową (telefon), pełne logo od md. „inline”: pełne logo w panelu. */
  variant?: "badge" | "inline";
};

/**
 * Znak Sawy, który otwiera menu aplikacji. Na telefonie menu to arkusz od dołu (jak w iOS),
 * na desktopie popover wyrastający spod logo.
 */
export function SawaMenuButton({ variant = "badge" }: SawaMenuButtonProps) {
  const t = useT();
  const actions = useContext(SawaMenuContext);
  const isDesktop = useIsDesktop();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  // Akcja z menu rusza dopiero, gdy arkusz zjedzie: najpierw wracamy na mapę, potem idziemy dalej.
  const pending = useRef<(() => void) | null>(null);

  function openMenu() {
    haptic();
    setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
    setCloseRequested(false);
    setOpen(true);
  }

  function finishClose() {
    setOpen(false);
    setCloseRequested(false);
    const action = pending.current;
    pending.current = null;
    if (action) action();
    else triggerRef.current?.focus();
  }

  function run(action: () => void) {
    haptic();
    if (isDesktop) {
      setOpen(false);
      action();
      return;
    }
    pending.current = action;
    setCloseRequested(true);
  }

  const content = actions && <MenuContent actions={actions} run={run} />;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("Menu Sawy", "Sawa menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !open && openMenu()}
        className={
          variant === "badge"
            ? "pointer-events-auto szklo flex size-12 items-center justify-center rounded-full p-1 transition-transform duration-100 active:scale-[0.94] md:w-auto md:gap-2 md:pr-4"
            : "-ml-1.5 flex items-center gap-2 rounded-full p-1 pr-3.5 transition-[transform,background-color] duration-100 hover:bg-tlo-2 active:scale-[0.97]"
        }
      >
        <SawaHead className={variant === "badge" ? "size-10" : "size-11"} />
        <Logo className={variant === "badge" ? "hidden text-[26px] md:inline" : "text-[28px]"} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          isDesktop ? (
            <AnimatePresence>
              {open && anchor && (
                <MenuPopover key="popover" anchor={anchor} onClose={() => setOpen(false)}>
                  {content}
                </MenuPopover>
              )}
            </AnimatePresence>
          ) : (
            open && (
              <MenuSheet closeRequested={closeRequested} onClosed={finishClose}>
                {content}
              </MenuSheet>
            )
          ),
          document.body,
        )}
    </>
  );
}

type MenuSheetProps = {
  closeRequested: boolean;
  onClosed: () => void;
  children: ReactNode;
};

/**
 * Arkusz od dołu: wjeżdża sprężyną, idzie za palcem 1:1, rzucony w dół zjeżdża z prędkością palca.
 * Przyciemnienie mapy zależy od położenia arkusza, więc gaśnie razem z nim, także w trakcie gestu.
 */
function MenuSheet({ closeRequested, onClosed, children }: MenuSheetProps) {
  const t = useT();
  const reduce = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(0);
  const base = useRef(0);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const [height, setHeight] = useState(0);
  const scrim = useTransform([y, opacity], ([yValue, opacityValue]: number[]) => {
    const shown = height > 0 ? 1 - Math.min(1, Math.max(0, yValue / height)) : 0;
    return shown * opacityValue;
  });

  function dismiss(velocity = 0) {
    if (reduce) {
      animate(opacity, 0, { duration: 0.2, onComplete: () => onClosedRef.current() });
      return;
    }
    animate(y, heightRef.current, { ...SPRING, velocity, onComplete: () => onClosedRef.current() });
  }

  // Tylko przy wejściu: arkusz montuje się na otwarcie i odmontowuje po zjechaniu.
  // biome-ignore lint/correctness/useExhaustiveDependencies: wartości ruchu są stabilne
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    heightRef.current = sheet.offsetHeight;
    setHeight(sheet.offsetHeight);
    if (reduce) {
      animate(opacity, 1, { duration: 0.2 });
    } else {
      opacity.set(1);
      y.set(sheet.offsetHeight);
      animate(y, 0, SPRING);
    }
    sheet.focus({ preventScroll: true });
    const observer = new ResizeObserver(() => {
      heightRef.current = sheet.offsetHeight;
      setHeight(sheet.offsetHeight);
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dismiss czyta stan przez refy
  useEffect(() => {
    if (closeRequested) dismiss();
  }, [closeRequested]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dismiss czyta stan przez refy
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useVerticalDrag(sheetRef, {
    shouldStart: (dy) => {
      const scroller = scrollRef.current;
      if (reduce || !scroller || scroller.scrollTop > 0) return false;
      // W górę tylko, gdy treść się mieści; inaczej ruch w górę przewija listę.
      return dy > 0 || scroller.scrollHeight <= scroller.clientHeight;
    },
    onStart: () => {
      y.stop();
      base.current = y.get();
    },
    onMove: (dy) => {
      const raw = base.current + dy;
      y.set(raw < 0 ? -rubberband(-raw, heightRef.current) : raw);
    },
    onEnd: (velocity) => {
      const landing = y.get() + project(velocity);
      if (landing > heightRef.current / 2) {
        haptic();
        dismiss(velocity);
        return;
      }
      animate(y, 0, { ...SPRING_FLICK, velocity });
    },
  });

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        aria-hidden="true"
        style={{ opacity: scrim }}
        onClick={() => dismiss()}
        className="absolute inset-0 bg-[#102b2a]/35"
      />
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("Menu Sawy", "Sawa menu")}
        tabIndex={-1}
        style={{ y, opacity }}
        className="karta absolute inset-x-2 bg-powierzchnia! bottom-[max(0.5rem,env(safe-area-inset-bottom))] rounded-[34px] outline-none"
      >
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-tekst/15"
        />
        <div
          ref={scrollRef}
          className="max-h-[85dvh] overflow-y-auto overscroll-contain px-4 pb-4 pt-6"
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

type MenuPopoverProps = {
  anchor: DOMRect;
  onClose: () => void;
  children: ReactNode;
};

/** Popover pod logo: rośnie z rogu, w którym jest logo, i wraca tą samą drogą. */
function MenuPopover({ anchor, onClose, children }: MenuPopoverProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hidden = { opacity: 0, scale: 0.9, y: -6, filter: "blur(6px)" };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-50" onPointerDown={onClose} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-label={t("Menu Sawy", "Sawa menu")}
        tabIndex={-1}
        initial={hidden}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={hidden}
        transition={POPOVER_SPRING}
        style={{ top: anchor.bottom + 10, left: anchor.left, transformOrigin: "24px 0" }}
        className="karta fixed z-50 bg-powierzchnia! max-h-[calc(100dvh-120px)] w-[340px] overflow-y-auto rounded-[28px] p-4 outline-none"
      >
        {children}
      </motion.div>
    </>
  );
}

const labelOf = (list: Choice[], key: string | null, lang: Lang) => {
  const item = list.find((choice) => choice.key === key);
  return item ? pick(lang, item.label, item.en.label) : null;
};

type MenuContentProps = {
  actions: SawaMenuActions;
  run: (action: () => void) => void;
};

function MenuContent({ actions, run }: MenuContentProps) {
  const { profile } = actions;
  const t = useT();
  const lang = useLang();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const musicOn = useMusicOn();
  const familiarity = labelOf(FAMILIARITY, profile.familiarity, lang);
  const style = labelOf(STORY_STYLES, profile.storyStyle, lang);
  const audience = labelOf(AUDIENCES, profile.audience, lang);
  // Nazwy w kolorach tematów: ta sama legenda co obwódki miejsc na mapie
  const interests = profile.interests.flatMap((key, i) => {
    const item = INTERESTS.find((interest) => interest.key === key);
    if (!item) return [];
    return [
      <span key={key} className="temat font-semibold text-(--temat)" style={topicStyle(item.key)}>
        {i > 0 && <span className="font-normal text-tekst-2">, </span>}
        {t(item.label, item.en.label)}
      </span>,
    ];
  });

  async function share() {
    haptic();
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Sawa",
          text: t(
            "Sawa opowiada o miejscach, które mijasz tramwajem i autobusem.",
            "Sawa tells you about the places you pass by tram and bus.",
          ),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zamknięty arkusz udostępniania albo brak zgody na schowek: nic nie robimy.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <SawaHead className="size-14" />
        <div className="min-w-0">
          <h2 className="font-logo text-[24px] font-semibold leading-none tracking-tight text-glebia">
            sawa<span className="text-koral">.</span>
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-tekst-2">
            {t(
              "Twoja przewodniczka po tym, co mijasz za oknem.",
              "Your guide to what you pass outside the window.",
            )}
          </p>
        </div>
      </header>

      <Group>
        <Row
          Icon={RoutesIcon}
          label={t("Gotowe przejażdżki", "Ready-made rides")}
          value={t("Trasy ułożone z Twoich tematów", "Routes built from your topics")}
          onClick={() => run(actions.onOpenRides)}
        />
        <Row
          Icon={BubbleIcon}
          label={t("Co opowiada Sawa", "What Sawa is telling")}
          value={
            actions.lastRouteStops !== null
              ? t("Teraz i to, co już opowiedziała", "Now and what she's already told")
              : t("Ruszy z pierwszą trasą", "Starts with your first ride")
          }
          onClick={() => run(actions.onOpenSawa)}
        />
      </Group>

      <Group title={t("Jak opowiadam", "How I tell stories")}>
        <Row
          Icon={SparkIcon}
          label={t("Zainteresowania", "Interests")}
          value={interests.length > 0 ? interests : t("Wszystko po trochu", "A bit of everything")}
          onClick={() => run(() => actions.onEditProfile("interests"))}
        />
        <Row
          Icon={CompassIcon}
          label={t("Znajomość miasta", "How well you know the city")}
          value={familiarity ?? t("Nie wybrano", "Not chosen")}
          onClick={() => run(() => actions.onEditProfile("familiarity"))}
        />
        <Row
          Icon={BubbleIcon}
          label={t("Styl opowieści", "Story style")}
          value={style ?? t("Nie wybrano", "Not chosen")}
          onClick={() => run(() => actions.onEditProfile("style"))}
        />
        <Row
          Icon={ListenerIcon}
          label={t("Kto słucha", "Who's listening")}
          value={audience ?? t("Dorośli", "Adults")}
          onClick={() => run(() => actions.onEditProfile("audience"))}
        />
        <Row
          Icon={PinIcon}
          label={t("Co już Ci opowiedziałam", "What I've already told you")}
          value={
            actions.rememberedPlaces === 0
              ? t(
                  "Jeszcze nic. Zapamiętam, co usłyszysz",
                  "Nothing yet. I'll remember what you hear",
                )
              : t(
                  `${placesLabel(actions.rememberedPlaces)} · od najnowszych`,
                  `${placesLabelEn(actions.rememberedPlaces)} · newest first`,
                )
          }
          onClick={() => run(actions.onOpenTold)}
        />
      </Group>

      <Group title={t("Skąd ruszamy", "Where we start")}>
        <Row
          Icon={LocateIcon}
          label={
            actions.startMode === "gps"
              ? t("Z Twojej lokalizacji", "From your location")
              : t("Spod 42 Warsaw", "From 42 Warsaw")
          }
          value={t(
            `${actions.startLabel} · stuknij, żeby zmienić`,
            `${actions.startLabel} · tap to change`,
          )}
          onClick={() => {
            haptic();
            actions.onStartModeChange(actions.startMode === "gps" ? "venue" : "gps");
          }}
          chevron={false}
        />
      </Group>

      <Group title={t("Dźwięk", "Sound")}>
        <Row
          Icon={MusicIcon}
          label={t("Muzyka w tle", "Background music")}
          value={
            musicOn
              ? t(
                  "Lo-fi i puls miasta, ciszej, gdy mówię · stuknij, żeby wyłączyć",
                  "Lo-fi and city pulse, quieter while I talk · tap to turn off",
                )
              : t("Wyłączona · stuknij, żeby włączyć", "Off · tap to turn on")
          }
          onClick={() => {
            haptic();
            setMusicOn(!musicOn);
          }}
          chevron={false}
        />
      </Group>

      <Group title={t("Wygląd", "Appearance")}>
        <div className="p-3">
          <ThemeSwitch />
        </div>
      </Group>

      <Group title="Język · Language">
        <div className="p-3">
          <LangSwitch />
        </div>
      </Group>

      <Group>
        {actions.lastRouteStops !== null && (
          <Row
            Icon={RoutesIcon}
            label={t("Ostatnia przejażdżka", "Last ride")}
            value={t(
              `${actions.lastRouteStops} opowieści`,
              `${actions.lastRouteStops} ${actions.lastRouteStops === 1 ? "story" : "stories"}`,
            )}
            onClick={() => run(actions.onOpenLastRoute)}
          />
        )}
        <Row
          Icon={ShareIcon}
          label={t("Poleć Sawę", "Recommend Sawa")}
          value={copied ? t("Skopiowano link", "Link copied") : undefined}
          onClick={share}
          chevron={false}
        />
        <Row
          Icon={InfoIcon}
          label={t("Skąd Sawa to wie", "How Sawa knows this")}
          onClick={() => {
            haptic();
            setAboutOpen((current) => !current);
          }}
          expanded={aboutOpen}
        />
        <AnimatePresence initial={false}>
          {aboutOpen && (
            <motion.div
              key="about"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SPRING}
              className="overflow-hidden"
            >
              <div className="space-y-2 px-4 pb-4 pt-1 text-[14px] leading-relaxed text-tekst-2">
                <p>
                  {t(
                    "Miejsca i fakty biorę z otwartych danych Warszawy (dane.um.warszawa.pl) i z OpenStreetMap. Trasy i odjazdy liczę z rozkładu ZTM.",
                    "I take places and facts from Warsaw's open data (dane.um.warszawa.pl) and OpenStreetMap. Routes and departures come from the ZTM timetable.",
                  )}
                </p>
                <p>
                  {t(
                    "Z tych faktów opowieść układa model językowy, a czyta ją syntezator mowy.",
                    "A language model turns these facts into a story, and a speech synthesiser reads it.",
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <button
        type="button"
        onClick={() => run(actions.onRestart)}
        className="flex h-12 items-center justify-center gap-2 rounded-[18px] text-[15px] font-bold text-koral transition-colors duration-100 active:bg-koral/10 md:hover:bg-koral/10"
      >
        <RestartIcon className="size-5" />
        {t("Zacznij od nowa", "Start over")}
      </button>
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className="etykieta mb-1.5 px-4">{title}</h3>}
      <div className="overflow-hidden rounded-[22px] bg-tlo-2 [&>*+*]:border-t [&>*+*]:border-tekst/[0.06]">
        {children}
      </div>
    </section>
  );
}

function placesLabel(n: number) {
  const tens = n % 100;
  const ones = n % 10;
  if (n === 1) return "1 miejsce";
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return `${n} miejsca`;
  return `${n} miejsc`;
}

function placesLabelEn(n: number) {
  return `${n} ${n === 1 ? "place" : "places"}`;
}

type RowProps = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value?: ReactNode;
  onClick: () => void;
  chevron?: boolean;
  /** Wiersz rozwijany: strzałka obraca się w dół, gdy treść jest widoczna. */
  expanded?: boolean;
};

function Row({ Icon, label, value, onClick, chevron = true, expanded }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100 active:bg-tekst/[0.06] md:hover:bg-tekst/[0.04]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-powierzchnia text-glebia shadow-[0_1px_2px_rgba(16,43,42,0.08)]">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-tekst">{label}</span>
        {value && (
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-tekst-2">
            {value}
          </span>
        )}
      </span>
      {chevron && (
        <ChevronRightIcon
          className={`size-4 shrink-0 text-tekst-3 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      )}
    </button>
  );
}
