import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { defaultConfig } from '../src/config'
import { dynamoDb, runningProcesses } from '../src/dynamodb'
import { exists } from '../src/utils'

// Mock external dependencies
mock.module('node:https', () => ({
  get: mock(() => ({
    on: mock(() => {}),
    pipe: mock(() => ({
      pipe: mock(() => ({
        on: mock(() => {}),
      })),
    })),
  })),
}))

describe('dynamodb-tooling', () => {
  describe('Config', () => {
    it('should load default config', () => {
      expect(defaultConfig).toBeDefined()
      expect(defaultConfig.local.port).toBe(8000)
      expect(defaultConfig.local.installPath).toBe('dynamodb-local')
    })

    it('should have single-table design config', () => {
      expect(defaultConfig.singleTableDesign).toBeDefined()
      expect(defaultConfig.singleTableDesign.enabled).toBe(true)
      expect(defaultConfig.singleTableDesign.partitionKeyName).toBe('pk')
      expect(defaultConfig.singleTableDesign.sortKeyName).toBe('sk')
    })

    it('should have query builder config', () => {
      expect(defaultConfig.queryBuilder).toBeDefined()
      expect(defaultConfig.queryBuilder.modelsPath).toBe('./app/models')
      expect(defaultConfig.queryBuilder.timestampFormat).toBe('iso')
    })

    it('should have capacity config', () => {
      expect(defaultConfig.capacity).toBeDefined()
      expect(defaultConfig.capacity.billingMode).toBe('PAY_PER_REQUEST')
    })
  })

  describe('DynamoDB Local (Docker)', () => {
    const testPort = 8001
    let process: ReturnType<typeof Bun.spawn> | undefined

    // Check if Docker is available
    const dockerAvailable = (() => {
      try {
        const result = Bun.spawnSync(['docker', '--version'])
        return result.exitCode === 0
      }
      catch {
        return false
      }
    })()

    afterAll(async () => {
      // Clean up: stop any running containers
      if (process) {
        dynamoDb.stop(testPort)
      }
    })

    it('should launch DynamoDB Local via Docker', async () => {
      if (!dockerAvailable) {
        console.log('Skipping Docker test - Docker not available')
        return
      }

      process = await dynamoDb.launch({ port: testPort, useDocker: true })
      expect(process).toBeDefined()
      expect(process?.pid).toBeDefined()

      // Give the container time to start
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Verify container is running
      const checkResult = Bun.spawnSync(['docker', 'ps', '-q', '-f', `name=dynamodb-local-${testPort}`])
      const containerId = checkResult.stdout.toString().trim()
      expect(containerId.length).toBeGreaterThan(0)
    })

    it('should not launch a second instance on the same port', async () => {
      if (!dockerAvailable) {
        console.log('Skipping Docker test - Docker not available')
        return
      }

      const secondProcess = await dynamoDb.launch({ port: testPort, useDocker: true })
      expect(String(secondProcess?.pid)).toBe(String(process?.pid))
    })

    it('should stop DynamoDB Local', () => {
      if (!dockerAvailable) {
        console.log('Skipping Docker test - Docker not available')
        return
      }

      dynamoDb.stop(testPort)
      expect(runningProcesses[testPort]).toBeUndefined()

      // Verify container is stopped
      const checkResult = Bun.spawnSync(['docker', 'ps', '-q', '-f', `name=dynamodb-local-${testPort}`])
      const containerId = checkResult.stdout.toString().trim()
      expect(containerId.length).toBe(0)
    })
  })

  describe('DynamoDB Local (Java) - Mocked Install', () => {
    const testPort = 8002
    const originalInstall = dynamoDb.install

    beforeAll(async () => {
      // Ensure the install directory exists for testing
      await fs.promises.mkdir(defaultConfig.local.installPath, { recursive: true })
      // Create a mock JAR file
      await fs.promises.writeFile(path.join(defaultConfig.local.installPath, 'DynamoDBLocal.jar'), '')

      // Mock the install method
      dynamoDb.install = mock(async () => {
        await fs.promises.writeFile(path.join(defaultConfig.local.installPath, 'DynamoDBLocal.jar'), '')
      })
    })

    afterAll(async () => {
      // Clean up the test install directory
      await fs.promises.rm(defaultConfig.local.installPath, { recursive: true, force: true })
      // Restore the original install method
      dynamoDb.install = originalInstall
    })

    it('should install DynamoDB Local', async () => {
      // Remove the mock JAR file to test installation
      await fs.promises.unlink(path.join(defaultConfig.local.installPath, 'DynamoDBLocal.jar'))

      await dynamoDb.install()
      const jarExists = await exists(path.join(defaultConfig.local.installPath, 'DynamoDBLocal.jar'))
      expect(jarExists).toBe(true)
      expect(dynamoDb.install).toHaveBeenCalled()
    })
  })

  describe('DynamoDB Local (Java) - Live Integration', () => {
    const testPort = 8003
    let process: ReturnType<typeof Bun.spawn> | undefined

    // Check if Java is available
    const javaAvailable = (() => {
      try {
        const result = Bun.spawnSync(['java', '-version'])
        return result.exitCode === 0
      }
      catch {
        return false
      }
    })()

    // Check if DynamoDB Local JAR exists
    const jarExists = (() => {
      try {
        const jarPath = path.join(defaultConfig.local.installPath, 'DynamoDBLocal.jar')
        return fs.existsSync(jarPath)
      }
      catch {
        return false
      }
    })()

    afterAll(() => {
      // Clean up: stop any running processes
      if (process) {
        dynamoDb.stop(testPort)
      }
    })

    it('should launch DynamoDB Local via Java when available', async () => {
      if (!javaAvailable) {
        console.log('Skipping Java test - Java not available')
        console.log('  Hint: Install Java via pantry: pantry install openjdk.org@21')
        return
      }

      if (!jarExists) {
        console.log('Skipping Java test - DynamoDB Local JAR not installed')
        console.log('  Hint: Run dynamoDb.install() first to download the JAR')
        return
      }

      process = await dynamoDb.launch({ port: testPort, useDocker: false })
      expect(process).toBeDefined()
      expect(process?.pid).toBeDefined()

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 3000))
    })

    it('should not launch a second instance on the same port', async () => {
      if (!javaAvailable || !jarExists || !process) {
        console.log('Skipping - prerequisite test was skipped')
        return
      }

      const secondProcess = await dynamoDb.launch({ port: testPort, useDocker: false })
      expect(String(secondProcess?.pid)).toBe(String(process?.pid))
    })

    it('should stop DynamoDB Local Java instance', () => {
      if (!javaAvailable || !jarExists || !process) {
        console.log('Skipping - prerequisite test was skipped')
        return
      }

      dynamoDb.stop(testPort)
      expect(runningProcesses[testPort]).toBeUndefined()
    })
  })

  describe('Utils', () => {
    const testDir = 'test-utils-dir'

    beforeAll(async () => {
      await fs.promises.mkdir(testDir, { recursive: true })
    })

    afterAll(async () => {
      await fs.promises.rm(testDir, { recursive: true, force: true })
    })

    it('should check if a file exists', async () => {
      const existingFile = path.join(testDir, 'test-file.txt')
      await fs.promises.writeFile(existingFile, '')

      expect(await exists(existingFile)).toBe(true)
      expect(await exists(path.join(testDir, 'non-existent-file.txt'))).toBe(false)

      await fs.promises.unlink(existingFile)
    })
  })
})
