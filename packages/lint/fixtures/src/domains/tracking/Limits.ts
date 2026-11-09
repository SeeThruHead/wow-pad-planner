export const remaining = (done: number, target: number, perWeek: number, restDays: number): number => {
  const sessions = Math.min(perWeek, Math.floor(7 / (restDays + 1)))
  const left = Math.max(0, target * sessions - done)

  return left > target ? target : left
}
