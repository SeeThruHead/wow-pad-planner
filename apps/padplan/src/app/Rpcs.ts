import { RpcGroup } from "effect/rpc"
import { Me, SetNickname } from "../features/account/contract.ts"
import { MyCharacters, SaveCharacter } from "../features/characters/contract.ts"
import { MyLayouts, SaveLayout } from "../features/layouts/contract.ts"

export const Rpcs = RpcGroup.make(Me, SetNickname, MyLayouts, SaveLayout, MyCharacters, SaveCharacter)
