// ============================================================================
// Serverless Integration
// ============================================================================

export {
  type APIGatewayEvent,
  type APIGatewayResponse,
  APIHandler,
  type CORSConfig,
  createAPIHandler,
  createSQSHandler,
  createStreamHandler,
  type DynamoDBStreamEvent,
  getHeader,
  getPathParams,
  getQueryParams,
  type HandlerResult,
  type LambdaContext,
  parseBody,
  type RouteDefinition,
  type SQSEvent,
  SQSHandler,
  StreamHandler,
} from './LambdaHandler'
