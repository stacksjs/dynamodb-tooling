import { dynamoDb } from './dist'

// eslint-disable-next-line no-console
console.log('Starting DynamoDB on port 8000')

const port = 8000
// if you want to share with Bun Shell
// eslint-disable-next-line antfu/no-top-level-await
const dd = await dynamoDb.launch()

// eslint-disable-next-line no-console
console.log('dd', dd)
// eslint-disable-next-line no-console
console.log(`DynamoDB started on port ${port}`)
