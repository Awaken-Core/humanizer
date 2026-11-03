/**
 * Public barrel export for the Grammar & Style Checker feature.
 */
export { checkGrammar } from "./grammar.service";
export {
  ANONYMOUS_MAX_GRAMMAR_LENGTH,
  AUTHENTICATED_MAX_GRAMMAR_LENGTH,
} from "./grammar.types";
export type {
  GrammarCheckInput,
  GrammarCheckResult,
  GrammarIssue,
  GrammarCategory,
} from "./grammar.types";
