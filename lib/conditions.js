// A question may carry condition = { field, in: [...] } that is checked against
// the participant's demographics (e.g. job questions only for working people).
export function isApplicable(question, demographics) {
  const c = question.condition;
  if (!c) return true;
  const v = demographics ? demographics[c.field] : undefined;
  return Array.isArray(c.in) ? c.in.includes(v) : true;
}
