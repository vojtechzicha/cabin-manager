import { describe, expect, it } from "vitest";

import {
  buildShareIntents,
  copyIntent,
  emailIntent,
  telegramIntent,
  whatsAppIntent,
} from "./share-intents";

const URL = "https://chata.test/auth/invite?token=abc-123";
const TEXT = "Pojď s námi na „Krkonoše“!";

describe("share intents (T-105)", () => {
  it("builds a WhatsApp link with text + url, URL-encoded", () => {
    const { channel, href } = whatsAppIntent({ url: URL, text: TEXT });
    expect(channel).toBe("whatsapp");
    expect(href).toContain("https://wa.me/?text=");
    // the live token URL must survive into the encoded payload
    expect(decodeURIComponent(href!)).toContain(URL);
    expect(decodeURIComponent(href!)).toContain(TEXT);
    // no raw spaces or quotes leaked into the query
    expect(href).not.toContain(" ");
    expect(href).not.toContain("„");
  });

  it("builds a Telegram share link with separate url and text params", () => {
    const { href } = telegramIntent({ url: URL, text: TEXT });
    expect(href).toContain("https://t.me/share/url?url=");
    expect(href).toContain(`url=${encodeURIComponent(URL)}`);
    expect(href).toContain(`text=${encodeURIComponent(TEXT)}`);
  });

  it("builds a mailto link with subject + body and %20 spaces", () => {
    const { href } = emailIntent({ url: URL, text: TEXT, subject: "Pozvánka na výlet" });
    expect(href!.startsWith("mailto:?")).toBe(true);
    expect(href).toContain("subject=");
    expect(href).toContain("body=");
    expect(href).not.toContain("+"); // mailto bodies want %20, not +
    expect(decodeURIComponent(href!)).toContain(URL);
  });

  it("copy intent carries the url inside the text payload", () => {
    const intent = copyIntent({ url: URL, text: TEXT });
    expect(intent.channel).toBe("copy");
    expect(intent.href).toBeUndefined();
    expect(intent.share?.text).toContain(URL);
    expect(intent.share?.url).toBe(URL);
  });

  it("does not duplicate the url when the text already contains it", () => {
    const textWithUrl = `${TEXT} ${URL}`;
    const intent = copyIntent({ url: URL, text: textWithUrl });
    const occurrences = intent.share!.text.split(URL).length - 1;
    expect(occurrences).toBe(1);
  });

  it("offers all five channels in order", () => {
    const intents = buildShareIntents({ url: URL, text: TEXT, subject: "s" });
    expect(intents.map((i) => i.channel)).toEqual([
      "whatsapp",
      "telegram",
      "email",
      "copy",
      "native",
    ]);
  });
});
