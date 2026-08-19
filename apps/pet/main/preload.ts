// IPC 브릿지. 채널이 확정되는 대로 contextBridge에 노출한다 (D6).
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('nosy', {})
