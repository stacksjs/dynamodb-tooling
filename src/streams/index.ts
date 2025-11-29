// ============================================================================
// DynamoDB Streams Processing
// ============================================================================

export {
  StreamProcessor,
  createStreamProcessor,
  type StreamEvent,
  type StreamRecord,
  type StreamEventType,
  type StreamProcessorConfig,
  type StreamHandler,
  type ChangeDataCapture,
  type EntityHandler,
  type StreamProcessorStats,
} from './StreamProcessor'
