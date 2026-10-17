import type { PlacePhoto } from "@sawa/shared";
import { describe, expect, it } from "vitest";
import { photoCredit, showablePhotos, thumbnailUrl } from "./photos";

const photo = (over: Partial<PlacePhoto>): PlacePhoto => ({
  url: "https://example.org/a.jpg",
  pageUrl: null,
  caption: null,
  year: null,
  author: null,
  source: null,
  license: null,
  ...over,
});

describe("showablePhotos", () => {
  it("drops scraped footer logos and duplicate urls", () => {
    const logo = photo({
      url: "https://www.warszawa1939.pl/sites/default/files/styles/footer_logo/public/media_uploaded/logo/mhp_logo.png",
    });
    const real = photo({
      url: "https://www.warszawa1939.pl/sites/default/files/styles/full/public/0012_a.jpg",
    });
    expect(showablePhotos([logo, real, real])).toEqual([real]);
  });

  it("treats one Commons file under different urls as one photo", () => {
    const first = photo({
      url: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Targ.jpg?utm_source=commons.wikimedia.org",
    });
    const again = photo({
      url: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Targ.jpg?utm_source=pl.wikipedia.org",
    });
    const thumb = photo({
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Targ.jpg/1280px-Targ.jpg",
    });
    expect(showablePhotos([first, again, thumb])).toEqual([first]);
  });
});

describe("photoCredit", () => {
  it("joins year, author and license", () => {
    expect(photoCredit(photo({ year: "1938", author: "NAC", license: "CC BY-SA 4.0" }))).toBe(
      "1938 · NAC · CC BY-SA 4.0",
    );
  });

  it("falls back to the source when the license is a seed note", () => {
    expect(
      photoCredit(photo({ license: "sprawdzić na Commons", source: "Wikipedia/Commons" })),
    ).toBe("Wikipedia/Commons");
  });
});

describe("thumbnailUrl", () => {
  it("asks Wikimedia for a 330 px thumbnail", () => {
    expect(
      thumbnailUrl(
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/A_b.jpg/1280px-A_b.jpg?utm_source=x",
      ),
    ).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/A_b.jpg/330px-A_b.jpg");
  });

  it("keeps other archives and smaller thumbnails as they are", () => {
    const other = "https://www.warszawa1939.pl/sites/default/files/styles/full/public/0012_a.jpg";
    const small = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/A.jpg/250px-A.jpg";
    expect(thumbnailUrl(other)).toBe(other);
    expect(thumbnailUrl(small)).toBe(small);
  });

  it("turns a Commons original into its 330 px thumbnail", () => {
    expect(
      thumbnailUrl(
        "https://upload.wikimedia.org/wikipedia/commons/5/5e/Targ.jpg?utm_content=original",
      ),
    ).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Targ.jpg/330px-Targ.jpg");
  });

  it("leaves formats Wikimedia renders differently, like TIFF", () => {
    const tiff = "https://upload.wikimedia.org/wikipedia/commons/5/5e/Plan.tif";
    expect(thumbnailUrl(tiff)).toBe(tiff);
  });
});
