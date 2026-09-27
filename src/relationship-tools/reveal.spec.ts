import { revealAnswers } from "./reveal";

describe("revealAnswers", () => {
  const answers = [
    { day: 0, userId: "me", body: "Mine day 0", updatedAt: "t1" },
    { day: 0, userId: "them", body: "Theirs day 0", updatedAt: "t2" },
    { day: 1, userId: "them", body: "Theirs day 1", updatedAt: "t3" },
  ];

  it("shows the partner's answer once the viewer has answered the same prompt", () => {
    const view = revealAnswers(answers, "me", (item) => String(item.day));
    expect(view.find((item) => item.day === 0 && item.userId === "them")).toMatchObject({ body: "Theirs day 0", pending: false });
  });

  it("hides the partner's answer until the viewer answers", () => {
    const view = revealAnswers(answers, "me", (item) => String(item.day));
    expect(view.find((item) => item.day === 1)).toMatchObject({ userId: "them", body: null, pending: true });
  });

  it("always shows the viewer their own answers", () => {
    const view = revealAnswers(answers, "them", (item) => String(item.day));
    expect(view.filter((item) => item.userId === "them").every((item) => item.body && !item.pending)).toBe(true);
    expect(view.find((item) => item.userId === "me")).toMatchObject({ body: "Mine day 0", pending: false });
  });
});
