import process from 'node:process'
import dts from 'bun-plugin-dts-auto'

// eslint-disable-next-line no-console
console.log('Building...')

Bun.build({
  entrypoints: [
    'src/index.ts',
  ],

  target: 'bun',
  outdir: './dist',

  plugins: [
    dts(),
  ],
})
  .then((result) => {
    if (result.success) {
      // eslint-disable-next-line no-console
      console.log('Build successful!')
      process.exit(0)
    }
    else {
      console.error('Build failed!', result)
      process.exit(1)
    }
  })
  .catch((err) => {
    console.error('Build process encountered an error:', err)
    process.exit(1)
  })
