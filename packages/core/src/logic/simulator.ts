import type { WhatIfSimulatorConfig } from "../schema/modules/what-if-simulator";
import { evaluateCondition, evaluateFormula } from "./formula";

export type SimulatorScope = Record<string, number>;

export function defaultInputs(config: WhatIfSimulatorConfig): SimulatorScope {
  return Object.fromEntries(config.content.inputs.map((i) => [i.id, i.default]));
}

/** Evaluate all outputs in order; outputs may reference earlier outputs. */
export function computeOutputs(
  config: WhatIfSimulatorConfig,
  inputs: SimulatorScope,
): SimulatorScope {
  const scope: SimulatorScope = { ...inputs };
  for (const out of config.content.outputs) {
    let v: number;
    try {
      v = evaluateFormula(out.formula, scope);
    } catch {
      v = NaN;
    }
    scope[out.id] = v;
  }
  return scope;
}

export function activeInsights(config: WhatIfSimulatorConfig, scope: SimulatorScope) {
  return config.content.insights.filter((ins) => {
    try {
      return evaluateCondition(ins.when, scope);
    } catch {
      return false;
    }
  });
}

export function challengeMet(config: WhatIfSimulatorConfig, scope: SimulatorScope): boolean {
  const goal = config.content.challenge?.goal;
  if (!goal) return false;
  try {
    return evaluateCondition(goal, scope);
  } catch {
    return false;
  }
}

export function formatValue(
  value: number,
  format: "number" | "currency" | "percent" | "integer",
  { currency = "USD", locale = "en" }: { currency?: string; locale?: string } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  try {
    switch (format) {
      case "currency":
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: value >= 100 ? 0 : 2,
        }).format(value);
      case "percent":
        return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
          value,
        );
      case "integer":
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
      default:
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
    }
  } catch {
    return String(value);
  }
}
