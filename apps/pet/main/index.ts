import { BrowserWindow, app } from 'electron'
import { createWindow } from './window'
import { startScheduler } from './scheduler'

app.whenReady().then(() => {
  const window = createWindow()
  startScheduler(window)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
