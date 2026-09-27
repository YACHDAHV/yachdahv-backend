type SharedAnswer = { userId: string; body: string; updatedAt: string };

/**
 * Both partners' answers stay private until each has responded to the same
 * prompt. The viewer always sees their own answer; the partner's answer is
 * returned without its body (pending) until the viewer has answered too.
 */
export function revealAnswers<T extends SharedAnswer>(answers: T[], viewerId: string, keyOf: (answer: T) => string) {
  const answeredByViewer = new Set(answers.filter((answer) => answer.userId === viewerId).map(keyOf));
  return answers.map((answer) => {
    if (answer.userId === viewerId || answeredByViewer.has(keyOf(answer))) return { ...answer, pending: false };
    const { body: _hidden, ...rest } = answer;
    return { ...rest, body: null, pending: true };
  });
}
