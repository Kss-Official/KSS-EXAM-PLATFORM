export interface ClientUIAction {
  action: "NAVIGATE" | "SET_CANDIDATE_FILTER" | "APPLY_SORT" | "OPEN_MODAL" | "SEARCH" | string;
  route?: string;
  params?: Record<string, any>;
  date?: string;
  slot?: string;
  department?: string;
  college?: string;
  status?: string;
  search?: string;
  column?: string;
  direction?: "asc" | "desc" | string;
  modal?: string;
  defaults?: Record<string, any>;
}

export const dispatchUIAction = (action: ClientUIAction, navigate: (to: string) => void) => {
  // 1. Live Navigation
  if (action.action === "NAVIGATE" && action.route) {
    let target = action.route;
    const q = new URLSearchParams();
    if (action.params) {
      if (action.params.examId !== undefined && action.params.examId !== null) {
        q.set("examId", String(action.params.examId));
      }
      if (action.params.sortBy === "score" || action.params.sort) {
        const order = action.params.sortOrder || (action.params.sort === "asc" ? "asc" : "desc");
        q.set("sort", order === "asc" ? "SCORE_ASC" : "SCORE_DESC");
      }
      if (action.params.date) q.set("date", String(action.params.date));
      if (action.params.slot) q.set("slot", String(action.params.slot));
      if (action.params.search) q.set("q", String(action.params.search));
    }
    const qs = q.toString();
    if (qs) {
      target = target.includes("?") ? `${target}&${qs}` : `${target}?${qs}`;
    }
    navigate(target);
  }

  // 2. Broadcast to any open page components via CustomEvent
  window.dispatchEvent(new CustomEvent("examsecure:ai-action", { detail: action }));
};
