/** Parse a comma-separated list of numbers from a user input string. */
export function parseNumberList(input: string): number[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => Number(s))
    .filter(n => !isNaN(n))
}
