const CODE_RE =
  /\b(code|coding|function|class|bug|debug|error|stack ?trace|refactor|implement|algorithm|regex|sql|query|api|typescript|javascript|python|rust|golang|java|react|compile|exception|script|endpoint|deploy|docker|optimi[sz]e|unit tests?)\b/i;
const RESEARCH_RE =
  /\b(explain why|compare|contrast|analy[sz]e|research|pros and cons|trade-?offs?|in[- ]depth|deep dive|step[- ]by[- ]step|prove|derive|evaluate|design|architecture|strategy|literature)\b/i;

/** Heuristic router: short, plain questions are "simple"; code or research asks are "complex". */
export function isComplex(prompt: string): boolean {
  const t = prompt.trim();
  if (t.length > 280) return true;
  if (t.split(/\s+/).length > 45) return true;
  if (t.includes("```") || t.split("\n").filter((l) => l.trim()).length >= 3) return true;
  return CODE_RE.test(t) || RESEARCH_RE.test(t);
}
