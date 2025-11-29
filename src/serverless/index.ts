// ============================================================================
// Serverless Integration
// ============================================================================

export {
  APIHandler,
  StreamHandler,
  SQSHandler,
  createAPIHandler,
  createStreamHandler,
  createSQSHandler,
  parseBody,
  getPathParams,
  getQueryParams,
  getHeader,
  type LambdaContext,
  type APIGatewayEvent,
  type APIGatewayResponse,
  type DynamoDBStreamEvent,
  type SQSEvent,
  type HandlerResult,
  type RouteDefinition,
  type CORSConfig,
} from './LambdaHandler'
