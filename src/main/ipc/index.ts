import { registerVideoHandlers } from './video'

export function registerAllIpcHandlers(): void {
  registerVideoHandlers()
}
