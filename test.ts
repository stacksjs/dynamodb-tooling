/* eslint-disable no-console, antfu/no-top-level-await, antfu/no-import-dist */
import { dynamoDb } from './dist/'

console.log('Starting DynamoDB on port 8000')

const port = 8000
// if you want to share with Bun Shell
const dd = await dynamoDb.launch()

console.log('dd', dd)
console.log(`DynamoDB started on port ${port}`)
