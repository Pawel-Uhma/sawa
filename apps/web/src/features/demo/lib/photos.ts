import type { PlacePhoto } from "@sawa/shared";

/*
 * Zdjęcia miejsca przy opowieści Sawy: które pokazać, jak podpisać (licencje CC wymagają
 * atrybucji) i jaki rozmiar ściągnąć na miniaturę.
 */

// Zeskrobane z warszawa1939.pl logo stopki (MHP) to nie zdjęcie miejsca
const NOT_A_PHOTO = /\/styles\/footer_logo\/|\/logo\//i;

// Plik z Wikimedia Commons, w oryginale albo miniaturze: grupa 1 to host i ścieżka, 2 to „a/ab”, 3 to plik
const WIKIMEDIA =
  /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/[^/]+\/)(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2})\/([^/?]+)/;

/** Ten sam plik pod różnymi adresami (miniatura, oryginał, inne utm_*) ma jeden klucz. */
function photoKey(url: string): string {
  const commons = WIKIMEDIA.exec(url);
  if (!commons) return url.split("?")[0];
  try {
    return `commons:${decodeURIComponent(commons[3])}`;
  } catch {
    return `commons:${commons[3]}`;
  }
}

/** Zdjęcia do pokazania: bez logotypów i powtórzeń tego samego pliku, w kolejności z bazy. */
export function showablePhotos(photos: readonly PlacePhoto[]): PlacePhoto[] {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (!photo.url || NOT_A_PHOTO.test(photo.url)) return false;
    const key = photoKey(photo.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Licencja do podpisu; notatka seeda w rodzaju „sprawdzić na Commons” to nie licencja. */
function licenseLabel(photo: PlacePhoto): string | null {
  const license = photo.license?.trim();
  if (license && !/^sprawdzi/i.test(license)) return license;
  return photo.source?.trim() || null;
}

/** Krótki podpis pod zdjęciem: rok · autor · licencja (albo źródło, gdy licencji brak). */
export function photoCredit(photo: PlacePhoto): string {
  return [photo.year?.trim(), photo.author?.trim(), licenseLabel(photo)]
    .filter(Boolean)
    .join(" · ");
}

// Wikimedia robi miniatury z JPG, PNG, GIF i WebP pod tą samą nazwą; inne formaty zostawiamy
const THUMBABLE = /\.(jpe?g|png|gif|webp)$/i;

/**
 * Mniejsza wersja zdjęcia na miniaturę: Wikimedia ma gotowe 330 px („…/thumb/a/ab/Plik.jpg/330px-Plik.jpg”),
 * a oryginał bywa kilkumegabajtowy. Inne archiwa i nieznane formaty dostają ten sam adres.
 */
export function thumbnailUrl(url: string, widthPx = 330): string {
  const commons = WIKIMEDIA.exec(url);
  if (!commons) return url;
  const [, base, hash, file] = commons;
  if (!THUMBABLE.test(file)) return url;
  const size = /\/(\d+)px-[^/?]+/.exec(url.slice(commons[0].length));
  if (size && Number(size[1]) <= widthPx) return url;
  return `${base}thumb/${hash}/${file}/${widthPx}px-${file}`;
}
