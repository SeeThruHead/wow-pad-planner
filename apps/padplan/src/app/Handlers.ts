import { Effect } from "effect"
import { me, setNickname } from "../features/account/handlers.ts"
import * as Admin from "../features/admin/handlers.ts"
import { myCharacters, saveCharacter } from "../features/characters/handlers.ts"
import { myLayouts, saveLayout } from "../features/layouts/handlers.ts"
import { Rpcs } from "./Rpcs.ts"

export const RpcHandlers = Rpcs.toLayer(
  Effect.succeed({
    Me: () => me,
    SetNickname: ({ nickname }) => setNickname(nickname),
    MyLayouts: () => myLayouts,
    SaveLayout: ({ layout }) => saveLayout(layout),
    MyCharacters: () => myCharacters,
    SaveCharacter: ({ saved }) => saveCharacter(saved),
    AdminWhoami: () => Admin.whoami,
    AdminListUsers: () => Admin.listUsers,
    AdminCreateUser: ({ subject, nickname }) => Admin.createUser(subject, nickname),
    AdminRenameUser: ({ userId, nickname }) => Admin.renameUser(userId, nickname),
    AdminDeleteUser: ({ userId }) => Admin.deleteUser(userId),
    AdminListTokens: () => Admin.listTokens,
    AdminMintToken: ({ role, userId, label }) => Admin.mintToken(role, userId, label),
    AdminRevokeToken: ({ tokenId }) => Admin.revokeToken(tokenId)
  })
)
