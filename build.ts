import process from 'node:process'
import dts from 'bun-plugin-dts-auto'

// eslint-disable-next-line no-console
console.log('Building...')

const result = await Bun.build({
  entrypoints: [
    'src/index.ts',
  ],

  target: 'bun',
  outdir: './dist',

  plugins: [
    dts(),
  ],
})

if (result.success) {
  // eslint-disable-next-line no-console
  console.log('Build successful!')
  process.exit(0)
}

console.error('Build failed!', result)
process.exit(1)
