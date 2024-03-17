<p align="center"><img src=".github/art/cover.png" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# DynamoDB Goodies

## Features

- Zero-config DynamoDB setup
- Local development with SSL support (wip)

## Install

```bash
bun install -d dynamodb-tooling
```

## Get Started

Getting started with the DynamoDB Tooling is easy. Just import `dynamoDb` and get going:

```ts
import { dynamoDb } from 'dynamodb-tooling'

interface LaunchOptions {
  port: number
  dbPath?: string
  additionalArgs?: string[]
  verbose?: boolean
  detached?: boolean
  javaOpts?: string
}

const childProcess = await dynamoDb.launch(options)
dynamoDb.stopChild(childProcess)
dynamoDb.stop(options.port)
dynamoDb.relaunch()

dynamoDb.configureInstaller()
await dynamoDb.install()
```

### Example

```ts
import { dynamoDb } from 'dynamodb-tooling'

const port = 8000;
// if you want to share with Bun Shell
await dynamoDb.launch({
  port,
  additionalArgs: ['-sharedDb'],
})
// do your tests / trigger your logic
dynamoDb.stop(port);
```

Alternatively, you can use it as a detached server:

```ts
const port = 8000
const child = await dynamoDb.launch({ port })
// trigger your logic
await dynamoDb.stopChild(child)
```

## Configuration

The client can be configured using a `dynamodb.config.ts` _(or `dynamodb.config.js`)_ file and it will be automatically loaded.

```ts
// dynamodb.config.ts (or dynamodb.config.js)
export default {
  installPath: path.join(os.tmpdir(), 'dynamodb-local'),
  downloadUrl: 'https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz', // the official download URL
}
```

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

Stacks OSS will always stay open-sourced, and we will always love to receive postcards from wherever Stacks is used!  _And we also publish them on our website. Thank you, Spatie._

Our address: Stacks.js, 5710 Crescent Park #107, Playa Vista 90094, CA, USA 🌎

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## Credits

- [dynamodb-local](https://github.com/rynop/dynamodb-local)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/bun-reverse-proxy?style=flat-square
[npm-version-href]: https://npmjs.com/package/bun-reverse-proxy
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/reverse-proxy/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/reverse-proxy/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/reverse-proxy/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/reverse-proxy -->
