export const flag = Boolean(process.env["FLAG"])
if (flag) throw new Error("on")
