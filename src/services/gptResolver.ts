import { AppError } from "../errors.js";
import type { GptCandidate, GptResolutionResult, RankedGptCandidate } from "../types.js";

export function normalizeGptName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let row = 0; row <= a.length; row += 1) {
    matrix[row]![0] = row;
  }
  for (let column = 0; column <= b.length; column += 1) {
    matrix[0]![column] = column;
  }

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + cost,
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

function score(query: string, candidate: string): number {
  if (query === candidate) {
    return 1;
  }

  if (candidate.startsWith(query) || query.startsWith(candidate)) {
    return 0.96;
  }

  const distance = levenshtein(query, candidate);
  const maxLength = Math.max(query.length, candidate.length);
  const similarity = maxLength === 0 ? 1 : 1 - distance / maxLength;
  const queryTokens = new Set(query.split(" "));
  const candidateTokens = new Set(candidate.split(" "));
  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  const tokenScore = overlap / Math.max(queryTokens.size, candidateTokens.size, 1);

  return Number(((similarity * 0.7) + (tokenScore * 0.3)).toFixed(4));
}

export class GptResolver {
  public rank(query: string, candidates: GptCandidate[]): RankedGptCandidate[] {
    const normalizedQuery = normalizeGptName(query);

    return candidates
      .map((candidate) => {
        const normalizedName = normalizeGptName(candidate.name);
        return {
          ...candidate,
          normalizedName,
          score: score(normalizedQuery, normalizedName),
        };
      })
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  }

  public resolve(query: string, candidates: GptCandidate[]): GptResolutionResult {
    const matches = this.rank(query, candidates).filter((candidate) => candidate.score >= 0.45);
    const best = matches[0];
    const second = matches[1];

    if (!best) {
      return {
        status: "not_found",
        query,
        matches: [],
      };
    }

    if (second && Math.abs(best.score - second.score) < 0.06 && second.score >= 0.75) {
      return {
        status: "ambiguous",
        query,
        matches,
      };
    }

    return {
      status: "resolved",
      query,
      matches,
      resolved: best,
    };
  }

  public resolveOrThrow(query: string, candidates: GptCandidate[]): RankedGptCandidate {
    const resolution = this.resolve(query, candidates);

    if (resolution.status === "resolved" && resolution.resolved) {
      return resolution.resolved;
    }

    throw new AppError("GPT_RESOLUTION_FAILED", "Unable to safely resolve the requested GPT.", {
      details: resolution,
    });
  }
}
