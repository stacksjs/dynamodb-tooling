import process from 'node:process'
import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

const result = await Bun.build({
  entrypoints: ['src/index.ts', 'bin/cli.ts'],
  splitting: true,
  naming: '[name].js',
  target: 'bun',
  outdir: './dist',
  // `inline` sourcemaps embed the entire source as base64 in the bundle,
  // roughly doubling the shipped size for zero consumer benefit. Drop them and
  // minify — the old 12 MB index.js was unminified bundle + inline map.
  minify: true,
  external: ['confbox'],
  plugins: [dts()],
})

if (!result.success) {
  console.error('Build failed')
  for (const message of result.logs) {
    console.error(message)
  }
  process.exit(1)
}

// `naming` already lands both entries flat in dist, so the copy-and-delete
// dance that used to flatten `dist/src` and `dist/bin` is gone with it.

console.log('Build successful!')
process.exit(0)
