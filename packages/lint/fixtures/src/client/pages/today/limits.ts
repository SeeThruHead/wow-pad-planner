export const leftToDo = (count: number, goal: number, times: number, rest: number): number => {
  const sessions = Math.min(times, Math.floor(7 / (rest + 1)))
  const left = Math.max(0, goal * sessions - count)

  return left > goal ? goal : left
}
