// node --test lib/harnessStream.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withQuote } from "./harnessStream.ts";

test("prefixes a multi-line quote to a string message", () => {
  const [m] = withQuote([{ type: "human", content: "why?" }], "a\nb");
  assert.equal(m.content, "> a\n> b\n\nwhy?");
});

test("adds a text part before image parts", () => {
  const image = { type: "image_url" as const, image_url: "data:x" };
  const [m] = withQuote([{ type: "human", content: [image] }], "q");
  assert.deepEqual(m.content, [{ type: "text", text: "> q\n\n" }, image]);
});

test("leaves messages alone without a quote or when the last one is not human", () => {
  const human = [{ type: "human" as const, content: "hi" }];
  assert.equal(withQuote(human, undefined), human);
  const tool = [{ type: "tool" as const, content: "{}", tool_call_id: "1", name: "t", status: "success" as const }];
  assert.equal(withQuote(tool, "q"), tool);
});
