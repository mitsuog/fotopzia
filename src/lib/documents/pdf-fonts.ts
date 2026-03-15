import path from 'node:path'

let registered = false

export async function ensurePdfFontsRegistered(): Promise<void> {
  if (registered) return
  const { Font } = await import('@react-pdf/renderer')
  const fontsDir = path.resolve(process.cwd(), 'public', 'fonts')
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(fontsDir, 'Roboto-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(fontsDir, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
    ],
  })
  registered = true
}
