import assert from "node:assert/strict";
import { test } from "node:test";
import { isAbsoluteHttpUrl, resolveAtlasRoot, rewriteAtlasIndexPreload } from "./root";

test("local atlas root follows the site base and contains index.json", () => {
  assert.equal(resolveAtlasRoot("/", undefined), "/atlas");
  assert.equal(resolveAtlasRoot("/", ""), "/atlas");
  assert.equal(resolveAtlasRoot("/", "   "), "/atlas");
  assert.equal(resolveAtlasRoot("/words/", null), "/words/atlas");
  assert.equal(`${resolveAtlasRoot("/", "")}/index.json`, "/atlas/index.json");
  assert.equal(`${resolveAtlasRoot("/words/", "")}/entries/0.json`, "/words/atlas/entries/0.json");
});

test("remote atlas root is the directory that contains index.json", () => {
  assert.equal(resolveAtlasRoot("/", "https://pub-xxx.r2.dev/atlas"), "https://pub-xxx.r2.dev/atlas");
  assert.equal(resolveAtlasRoot("/words/", "https://pub-xxx.r2.dev/atlas/"), "https://pub-xxx.r2.dev/atlas");
  assert.equal(resolveAtlasRoot("/", "https://media.example.com"), "https://media.example.com");
  assert.equal(
    `${resolveAtlasRoot("/", "https://pub-xxx.r2.dev/atlas/")}/index.json`,
    "https://pub-xxx.r2.dev/atlas/index.json",
  );
  assert.equal(
    `${resolveAtlasRoot("/", "https://pub-xxx.r2.dev/atlas/")}/audio/uk/abandon.mp3`,
    "https://pub-xxx.r2.dev/atlas/audio/uk/abandon.mp3",
  );
});

test("index preload stays local unless a remote base is set", () => {
  const html = `<link rel="preload" href="%BASE_URL%atlas/index.json" as="fetch" crossorigin="anonymous" />`;
  assert.equal(rewriteAtlasIndexPreload(html, ""), html);
  assert.equal(rewriteAtlasIndexPreload(html, "   "), html);
  assert.equal(
    rewriteAtlasIndexPreload(html, "https://pub-xxx.r2.dev/atlas/"),
    `<link rel="preload" href="https://pub-xxx.r2.dev/atlas/index.json" as="fetch" crossorigin="anonymous" />`,
  );
  assert.equal(
    rewriteAtlasIndexPreload(
      `<link rel="preload" href="/words/atlas/index.json" as="fetch" crossorigin="anonymous" />`,
      "https://media.example.com",
    ),
    `<link rel="preload" href="https://media.example.com/index.json" as="fetch" crossorigin="anonymous" />`,
  );
});

test("only absolute http(s) asset URLs are treated as cross-origin", () => {
  assert.equal(isAbsoluteHttpUrl("/atlas/img/a.webp"), false);
  assert.equal(isAbsoluteHttpUrl("atlas/img/a.webp"), false);
  assert.equal(isAbsoluteHttpUrl("https://pub-xxx.r2.dev/atlas/img/a.webp"), true);
  assert.equal(isAbsoluteHttpUrl("http://127.0.0.1:5188/atlas/img/a.webp"), true);
});
