import type { Step } from './types.ts'

/** Evaluate a tooltip template string, substituting {index}, {value}, and {varname} placeholders. */
export function evaluateTooltip(
  template: string,
  step: Step,
  context: { index?: number; value?: number },
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name) => {
    if (name === 'index' && context.index !== undefined) return String(context.index)
    if (name === 'value' && context.value !== undefined) return String(context.value)
    // Look up variable in step data (innermost frame first, then globals)
    if (step.callStack.length > 0) {
      const frame = step.callStack[step.callStack.length - 1]
      if (name in frame.variables) return String(frame.variables[name].num)
    }
    if (name in step.variables) return String(step.variables[name].num)
    return `{${name}}`
  })
}
