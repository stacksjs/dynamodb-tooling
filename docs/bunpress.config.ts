import type { BunPressConfig } from 'bunpress'

export default {
  name: 'dynamodb-tooling',
  description: 'A comprehensive DynamoDB toolkit for TypeScript with single-table design and Laravel-style ORM',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/reference' },
      { text: 'GitHub', link: 'https://github.com/stacksjs/dynamodb-tooling' }
    ],
    sidebar: {
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/guide/getting-started' }
          ]
        },
        {
          text: 'Core Features',
          items: [
            { text: 'Table Operations', link: '/guide/tables' },
            { text: 'Query Helpers', link: '/guide/queries' },
            { text: 'Local Development', link: '/guide/local' }
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Single-Table Design', link: '/features/single-table' },
            { text: 'Batch Operations', link: '/features/batch' },
            { text: 'Transactions', link: '/features/transactions' },
            { text: 'Streams', link: '/features/streams' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Index Strategies', link: '/advanced/indexes' },
            { text: 'Query Optimization', link: '/advanced/optimization' },
            { text: 'Migration Patterns', link: '/advanced/migrations' },
            { text: 'Testing', link: '/advanced/testing' }
          ]
        },
        {
          text: 'API Reference',
          items: [
            { text: 'API Reference', link: '/api/reference' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/stacksjs/dynamodb-tooling' },
      { icon: 'discord', link: 'https://discord.gg/stacksjs' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present Stacks.js'
    }
  }
} satisfies BunPressConfig
