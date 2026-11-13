/**
 * A tiny, safe arithmetic/boolean expression evaluator for the What-If simulator.
 * Supports: numbers, identifiers, + - * / %, unary minus, parentheses,
 * comparisons (< <= > >= == !=), `and` / `or` / `not`, and the functions
 * min, max, round, abs, floor, ceil, clamp.
 *
 * It is a hand-written recursive-descent parser: no eval, no Function().
 */

export type FormulaNode =
  | { kind: "num"; value: number }
  | { kind: "ref"; name: string }
  | { kind: "unary"; op: "-" | "not"; arg: FormulaNode }
  | { kind: "binary"; op: BinaryOp; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; fn: FormulaFn; args: FormulaNode[] };

export type BinaryOp =
  "+" | "-" | "*" | "/" | "%" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "and" | "or";
export type FormulaFn = "min" | "max" | "round" | "abs" | "floor" | "ceil" | "clamp";

const FUNCTIONS: Record<FormulaFn, { arity: [number, number]; impl: (...a: number[]) => number }> =
  {
    min: { arity: [1, 16], impl: (...a) => Math.min(...a) },
    max: { arity: [1, 16], impl: (...a) => Math.max(...a) },
    round: {
      arity: [1, 2],
      impl: (v, d = 0) => {
        const f = 10 ** d;
        return Math.round(v * f) / f;
      },
    },
    abs: { arity: [1, 1], impl: (v) => Math.abs(v) },
    floor: { arity: [1, 1], impl: (v) => Math.floor(v) },
    ceil: { arity: [1, 1], impl: (v) => Math.ceil(v) },
    clamp: { arity: [3, 3], impl: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) },
  };

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "("; v: "(" }
  | { t: ")"; v: ")" }
  | { t: ","; v: "," }
  | { t: "end"; v: "" };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\.?/i.exec(src.slice(i));
      if (!m) throw new Error(`bad number at ${i}`);
      tokens.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_-]*/.exec(src.slice(i))!;
      tokens.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) {
      tokens.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%<>!".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ t: "(", v: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: ")", v: ")" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ t: ",", v: "," });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${ch}" at position ${i}`);
  }
  tokens.push({ t: "end", v: "" });
  return tokens;
}

class Parser {
  private pos = 0;
  readonly refs = new Set<string>();
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }
  private next(): Token {
    return this.tokens[this.pos++]!;
  }
  private isOp(v: string): boolean {
    const tk = this.peek();
    return (tk.t === "op" && tk.v === v) || (tk.t === "id" && tk.v === v);
  }

  parse(): FormulaNode {
    const node = this.parseOr();
    if (this.peek().t !== "end") throw new Error(`unexpected token "${this.peek().v}"`);
    return node;
  }
  private parseOr(): FormulaNode {
    let left = this.parseAnd();
    while (this.isOp("or") || this.isOp("||")) {
      this.next();
      left = { kind: "binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }
  private parseAnd(): FormulaNode {
    let left = this.parseNot();
    while (this.isOp("and") || this.isOp("&&")) {
      this.next();
      left = { kind: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }
  private parseNot(): FormulaNode {
    if (this.isOp("not") || this.isOp("!")) {
      this.next();
      return { kind: "unary", op: "not", arg: this.parseNot() };
    }
    return this.parseComparison();
  }
  private parseComparison(): FormulaNode {
    let left = this.parseAdditive();
    for (;;) {
      const tk = this.peek();
      if (tk.t === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(tk.v)) {
        this.next();
        left = { kind: "binary", op: tk.v as BinaryOp, left, right: this.parseAdditive() };
      } else return left;
    }
  }
  private parseAdditive(): FormulaNode {
    let left = this.parseTerm();
    for (;;) {
      const tk = this.peek();
      if (tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
        this.next();
        left = { kind: "binary", op: tk.v, left, right: this.parseTerm() };
      } else return left;
    }
  }
  private parseTerm(): FormulaNode {
    let left = this.parseUnary();
    for (;;) {
      const tk = this.peek();
      if (tk.t === "op" && (tk.v === "*" || tk.v === "/" || tk.v === "%")) {
        this.next();
        left = { kind: "binary", op: tk.v, left, right: this.parseUnary() };
      } else return left;
    }
  }
  private parseUnary(): FormulaNode {
    if (this.isOp("-")) {
      this.next();
      return { kind: "unary", op: "-", arg: this.parseUnary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }
  private parsePrimary(): FormulaNode {
    const tk = this.next();
    if (tk.t === "num") return { kind: "num", value: tk.v };
    if (tk.t === "(") {
      const inner = this.parseOr();
      if (this.next().t !== ")") throw new Error("missing closing parenthesis");
      return inner;
    }
    if (tk.t === "id") {
      if (tk.v === "true") return { kind: "num", value: 1 };
      if (tk.v === "false") return { kind: "num", value: 0 };
      if (this.peek().t === "(") {
        if (!(tk.v in FUNCTIONS)) throw new Error(`unknown function "${tk.v}"`);
        this.next();
        const args: FormulaNode[] = [];
        if (this.peek().t !== ")") {
          args.push(this.parseOr());
          while (this.peek().t === ",") {
            this.next();
            args.push(this.parseOr());
          }
        }
        if (this.next().t !== ")") throw new Error(`missing ")" after ${tk.v}(…)`);
        const fn = tk.v as FormulaFn;
        const [lo, hi] = FUNCTIONS[fn].arity;
        if (args.length < lo || args.length > hi)
          throw new Error(`${fn} expects ${lo === hi ? lo : `${lo}–${hi}`} argument(s)`);
        return { kind: "call", fn, args };
      }
      this.refs.add(tk.v);
      return { kind: "ref", name: tk.v };
    }
    throw new Error(tk.t === "end" ? "unexpected end of formula" : `unexpected "${tk.v}"`);
  }
}

export type ParseResult =
  { ok: true; ast: FormulaNode; refs: string[] } | { ok: false; error: string };

export function parseFormula(source: string): ParseResult {
  try {
    const parser = new Parser(tokenize(source));
    const ast = parser.parse();
    return { ok: true, ast, refs: [...parser.refs] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const cache = new Map<string, ParseResult>();
function parseCached(source: string): ParseResult {
  let r = cache.get(source);
  if (!r) {
    r = parseFormula(source);
    if (cache.size > 500) cache.clear();
    cache.set(source, r);
  }
  return r;
}

export function evaluateAst(node: FormulaNode, scope: Record<string, number>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ref": {
      // Own properties only: names such as "constructor" must never resolve to Object.prototype members.
      const v = Object.prototype.hasOwnProperty.call(scope, node.name)
        ? scope[node.name]
        : undefined;
      if (typeof v !== "number") throw new Error(`unknown identifier "${node.name}"`);
      return v;
    }
    case "unary": {
      const v = evaluateAst(node.arg, scope);
      return node.op === "-" ? -v : v ? 0 : 1;
    }
    case "call":
      return FUNCTIONS[node.fn].impl(...node.args.map((a) => evaluateAst(a, scope)));
    case "binary": {
      const l = evaluateAst(node.left, scope);
      if (node.op === "and") return l ? (evaluateAst(node.right, scope) ? 1 : 0) : 0;
      if (node.op === "or") return l ? 1 : evaluateAst(node.right, scope) ? 1 : 0;
      const r = evaluateAst(node.right, scope);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? (l === 0 ? 0 : l > 0 ? Infinity : -Infinity) : l / r;
        case "%":
          return r === 0 ? 0 : l % r;
        case "<":
          return l < r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;
        case "==":
          return Math.abs(l - r) < 1e-9 ? 1 : 0;
        case "!=":
          return Math.abs(l - r) >= 1e-9 ? 1 : 0;
      }
    }
  }
}

/** Evaluate a formula string against a scope. Throws on parse or evaluation errors. */
export function evaluateFormula(source: string, scope: Record<string, number>): number {
  const parsed = parseCached(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return evaluateAst(parsed.ast, scope);
}

/** Evaluate a formula as a boolean. Non-finite values are treated as false. */
export function evaluateCondition(source: string, scope: Record<string, number>): boolean {
  const v = evaluateFormula(source, scope);
  return Number.isFinite(v) && v !== 0;
}
