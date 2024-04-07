import { dynamoDb } from './src'

// eslint-disable-next-line no-console
console.log('Starting DynamoDB on port 8000')

const port = 8000
// if you want to share with Bun Shell
const dd = await dynamoDb.launch({
  port,
  additionalArgs: ['-sharedDb'],
})

// eslint-disable-next-line no-console
console.log('dd', dd)
// eslint-disable-next-line no-console
console.log(`DynamoDB started on port ${port}`)
