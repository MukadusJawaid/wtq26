/**
 * Arithmetic done in code, not by the model. The model proposes an expression
 * (numbers and + - * / parentheses); we evaluate it here and check that the
 * result really appears in the answer text. No eval(): a small parser.
 */

type Token = { type: "num"; value: number } | { type: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([-+*/()]))/y;
  let pos = 0;
  while (pos < input.length) {
    re.lastIndex = pos;
    const m = re.exec(input);
    if (!m) return input.slice(pos).trim() === "" ? tokens : null;
    tokens.push(m[1] !== undefined ? { type: "num", value: Number(m[1]) } : { type: "op", value: m[2] as "+" });
    pos = re.lastIndex;
  }
  return tokens;
}

/** Evaluates a plain arithmetic expression. Returns null for anything invalid or non-finite. */
export function evaluate(expression: string): number | null {
  const tokens = tokenize(expression.replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/"));
  if (!tokens?.length) return null;
  let i = 0;

  // expr   := term (('+' | '-') term)*
  // term   := factor (('*' | '/') factor)*
  // factor := number | '-' factor | '(' expr ')'
  const expr = (): number | null => {
    let left = term();
    while (left !== null && i < tokens.length) {
      const t = tokens[i];
      if (t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      i++;
      const right = term();
      if (right === null) return null;
      left = t.value === "+" ? left + right : left - right;
    }
    return left;
  };
  const term = (): number | null => {
    let left = factor();
    while (left !== null && i < tokens.length) {
      const t = tokens[i];
      if (t.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      i++;
      const right = factor();
      if (right === null) return null;
      if (t.value === "/" && right === 0) return null;
      left = t.value === "*" ? left * right : left / right;
    }
    return left;
  };
  const factor = (): number | null => {
    const t = tokens[i++];
    if (!t) return null;
    if (t.type === "num") return t.value;
    if (t.value === "-") {
      const v = factor();
      return v === null ? null : -v;
    }
    if (t.value === "(") {
      const v = expr();
      if (v === null || tokens[i]?.type !== "op" || (tokens[i] as { value: string }).value !== ")") return null;
      i++;
      return v;
    }
    return null;
  };

  const result = expr();
  return result !== null && i === tokens.length && Number.isFinite(result) ? result : null;
}

export type Unit = "pkr" | "percent" | "units" | "none";

const group = (n: number, decimals: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** "569.62 / 3430.24 * 100" -> "569.62 ÷ 3,430.24 × 100" */
export function prettyExpression(expression: string): string {
  return expression
    .replace(/,/g, "")
    .replace(/\d+(?:\.\d+)?/g, (n) => group(Number(n), n.includes(".") ? n.split(".")[1].length : 0))
    .replace(/\*/g, "×")
    .replace(/\//g, "÷");
}

export function formatResult(value: number, unit: Unit): string {
  const rounded = Math.round(value * 100) / 100;
  if (unit === "percent") return `${group(rounded, 2)}%`;
  if (unit === "pkr") return `PKR ${group(rounded, 2)}`;
  return group(rounded, Number.isInteger(rounded) ? 0 : 2);
}

/** True when the computed value (or its percent form) appears as a number in the answer text. */
export function appearsInText(value: number, text: string): boolean {
  const numbers = [...text.replace(/,/g, "").matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const tolerance = Math.max(0.051, Math.abs(value) * 0.005);
  return numbers.some((n) => Math.abs(n - value) <= tolerance || Math.abs(Math.abs(n) - Math.abs(value)) <= tolerance);
}
