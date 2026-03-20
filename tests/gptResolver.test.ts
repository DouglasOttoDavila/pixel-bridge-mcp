import assert from "node:assert/strict";
import { GptResolver, normalizeGptName } from "../src/services/gptResolver.js";

export async function runGptResolverTests(): Promise<void> {
  const resolver = new GptResolver();
  const candidates = [
    { name: "DALL-E 3 Studio" },
    { name: "Brand Moodboard Builder" },
    { name: "Presentation Maker Pro" },
    { name: "Presentation Master" },
  ];

  assert.equal(normalizeGptName(" DALL-E 3!! "), "dall e 3");

  {
    const result = resolver.resolve("Brand Moodboard Builder", candidates);
    assert.equal(result.status, "resolved");
    assert.equal(result.resolved?.name, "Brand Moodboard Builder");
  }

  {
    const result = resolver.resolve("Presntation Master", candidates);
    assert.equal(result.status, "resolved");
    assert.equal(result.resolved?.name, "Presentation Master");
  }

  {
    const result = resolver.resolve("Presentation", candidates);
    assert.equal(result.status, "ambiguous");
    assert.deepEqual(result.matches.slice(0, 2).map((match) => match.name), [
      "Presentation Maker Pro",
      "Presentation Master",
    ]);
  }

  {
    const result = resolver.resolve("Wildly Different GPT", candidates);
    assert.equal(result.status, "not_found");
    assert.equal(result.matches.length, 0);
  }
}
