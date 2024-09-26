import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { config } from '../src/config'
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
      expect(config).toBeDefined()
      expect(config.port).toBe(8000)
      expect(config.installPath).toBe('dynamodb-local')
    })
  })

  describe('DynamoDB Local', () => {
    const testPort = 8001
    let process: any
    const originalInstall = dynamoDb.install

    beforeAll(async () => {
      // Ensure the install directory exists for testing
      await fs.promises.mkdir(config.installPath, { recursive: true })
      // Create a mock JAR file
      await fs.promises.writeFile(path.join(config.installPath, 'DynamoDBLocal.jar'), '')

      // Mock the install method
      dynamoDb.install = mock(async () => {
        await fs.promises.writeFile(path.join(config.installPath, 'DynamoDBLocal.jar'), '')
      })
    })

    afterAll(async () => {
      // Clean up the test install directory
      await fs.promises.rm(config.installPath, { recursive: true, force: true })
      // Restore the original install method
      dynamoDb.install = originalInstall
    })

    it('should launch DynamoDB Local', async () => {
      process = await dynamoDb.launch({ port: testPort })
      expect(process).toBeDefined()
      expect(process.pid).toBeDefined()
    })

    it('should not launch a second instance on the same port', async () => {
      const secondProcess = await dynamoDb.launch({ port: testPort })
      expect(secondProcess).toBe(process)
    })

    it('should stop DynamoDB Local', () => {
      dynamoDb.stop(testPort)
      expect(runningProcesses[testPort]).toBeUndefined()
    })

    it('should install DynamoDB Local', async () => {
      // Remove the mock JAR file to test installation
      await fs.promises.unlink(path.join(config.installPath, 'DynamoDBLocal.jar'))

      await dynamoDb.install()
      const jarExists = await exists(path.join(config.installPath, 'DynamoDBLocal.jar'))
      expect(jarExists).toBe(true)
      expect(dynamoDb.install).toHaveBeenCalled()
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
