# Local Development

Learn how to set up and use DynamoDB Local for development.

## Installation

### Using CLI

```bash
# Install DynamoDB Local
dbtooling install

# This downloads and configures DynamoDB Local in your project
```

### Manual Installation

```bash
# Download from AWS
curl -O https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz
tar -xzf dynamodb_local_latest.tar.gz
```

## Starting DynamoDB Local

### Using CLI

```bash
# Start with default settings (port 8000)
dbtooling start

# Custom port
dbtooling start --port 8001

# With persistent storage
dbtooling start --db-path ./data/dynamodb

# In-memory mode (data lost on restart)
dbtooling start --in-memory
```

### Programmatic Start

```typescript
import { dynamoDb } from 'dynamodb-tooling'

// Start DynamoDB Local
await dynamoDb.launch({
  port: 8000,
  inMemory: false,
  dbPath: './data/dynamodb'
})
```

## Stopping DynamoDB Local

```bash
# Stop instance on default port
dbtooling stop

# Stop specific port
dbtooling stop --port 8001

# Stop all instances
dbtooling stop --all
```

```typescript
// Programmatic stop
dynamoDb.stop(8000)
```

## Status Check

```bash
# Check running instances
dbtooling status
```

## Configuration

### Config File

Configure local settings in `dynamodb.config.ts`:

```typescript
export default {
  // ... other config

  local: {
    enabled: true,
    port: 8000,
    dbPath: './data/dynamodb',
    inMemory: false,
    sharedDb: true,
    delayTransientStatuses: false
  }
} satisfies DynamoDBConfig
```

### Environment Detection

dynamodb-tooling automatically uses local settings in development:

```typescript
// Automatically connects to local in development
const user = await User.find('123')

// Force production
process.env.DYNAMODB_LOCAL = 'false'
```

### Environment Variables

```bash
# .env
DYNAMODB_LOCAL=true
DYNAMODB_LOCAL_PORT=8000
DYNAMODB_LOCAL_PATH=./data/dynamodb
```

## Working with Local Tables

### Create Tables

```bash
# Create tables from models
dbtooling table:create

# Or use migrate
dbtooling migrate
```

### Seed Data

```bash
# Run seeders
dbtooling seed

# Fresh start (drop, create, seed)
dbtooling db:fresh
```

### Query Data

```bash
# Query items
dbtooling query --pk USER#1

# Scan table
dbtooling scan

# Get specific item
dbtooling get --pk USER#1 --sk USER#1
```

## Testing

### Test Setup

```typescript
// test/setup.ts
import { dynamoDb, createTableFromModels } from 'dynamodb-tooling'

beforeAll(async () => {
  // Start DynamoDB Local
  await dynamoDb.launch({ port: 8001, inMemory: true })

  // Create test tables
  await createTableFromModels('./app/models')
})

afterAll(async () => {
  dynamoDb.stop(8001)
})

beforeEach(async () => {
  // Clear tables before each test
  await clearAllTables()
})
```

### Integration Tests

```typescript
import { User } from '../app/models/User'

describe('User', () => {
  it('creates a user', async () => {
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test User'
    })

    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')
  })

  it('finds a user', async () => {
    const created = await User.create({
      email: 'find@example.com',
      name: 'Find Me'
    })

    const found = await User.find(created.id)

    expect(found).toBeDefined()
    expect(found!.name).toBe('Find Me')
  })
})
```

## Docker Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  dynamodb:
    image: amazon/dynamodb-local:latest
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "/data"]
    volumes:
      - dynamodb-data:/data

volumes:
  dynamodb-data:
```

### Using Docker

```bash
# Start DynamoDB Local
docker-compose up -d dynamodb

# Check logs
docker-compose logs dynamodb

# Stop
docker-compose down
```

### Configuration for Docker

```typescript
export default {
  local: {
    enabled: process.env.NODE_ENV !== 'production',
    endpoint: 'http://localhost:8000'
  }
} satisfies DynamoDBConfig
```

## Admin UI

### DynamoDB Admin

Install a web-based admin UI:

```bash
npm install -g dynamodb-admin
```

```bash
# Start admin UI
DYNAMO_ENDPOINT=http://localhost:8000 dynamodb-admin

# Opens at http://localhost:8001
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
dbtooling start --port 8001
```

### Java Not Found

DynamoDB Local requires Java:

```bash
# macOS
brew install openjdk

# Ubuntu
sudo apt install default-jre

# Verify
java -version
```

### Connection Refused

```typescript
// Ensure endpoint is correct
export default {
  local: {
    endpoint: 'http://localhost:8000'  // Not https
  }
}
```

### Data Not Persisting

```bash
# Use persistent storage
dbtooling start --db-path ./data/dynamodb

# Avoid --in-memory flag
```

## Best Practices

1. **Use in-memory mode for tests**: Faster and isolated
2. **Use persistent storage for development**: Keep data between restarts
3. **Match production settings**: Same table names, GSIs, etc.
4. **Seed realistic data**: Test with production-like data
5. **Automate setup**: Script table creation and seeding

## Example Workflow

```bash
# Start development environment
dbtooling start

# Create/update tables
dbtooling migrate

# Seed data
dbtooling seed

# Run application
bun run dev

# Run tests (separate instance)
DYNAMODB_LOCAL_PORT=8001 bun test

# Stop when done
dbtooling stop
```

## Next Steps

- Learn about [table operations](./tables.md)
- Explore [query helpers](./queries.md)
