# Implementation Plan

- [x] 1. Set up core publishing infrastructure and types
  - Create PublishingService struct and basic methods in `management/publishing.go`
  - Add publishing-related types to `management/types.go` (PublishConfig, PublishedModel, RateLimitConfig, etc.)
  - Add publishing service initialization to `management/main.go`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Extend K8s client with Gateway API operations
  - [x] 2.1 Add HTTPRoute CRUD operations to `management/k8s.go`
    - Implement CreateHTTPRoute, UpdateHTTPRoute, DeleteHTTPRoute methods
    - Add HTTPRoute resource validation and error handling
    - _Requirements: 1.4, 1.6_

  - [x] 2.2 Add AIGatewayRoute CRUD operations to `management/k8s.go`
    - Implement CreateAIGatewayRoute, UpdateAIGatewayRoute, DeleteAIGatewayRoute methods
    - Add AIGatewayRoute resource validation for OpenAI compatibility
    - _Requirements: 1.5, 1.6_

  - [x] 2.3 Add BackendTrafficPolicy operations for rate limiting
    - Implement CreateBackendTrafficPolicy, UpdateBackendTrafficPolicy, DeleteBackendTrafficPolicy methods
    - Add rate limiting policy validation and configuration
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.4 Add API key secret management operations
    - Implement CreateAPIKeySecret, UpdateAPIKeySecret, DeleteAPIKeySecret methods
    - Add secure API key generation and storage functionality
    - _Requirements: 1.3, 4.3_

- [ ] 3. Implement core publishing service functionality
  - [-] 3.1 Implement model type detection logic
    - Add logic to determine if model supports traditional inference or OpenAI schema
    - Create model capability analysis based on InferenceService configuration
    - _Requirements: 1.4, 1.5_

  - [ ] 3.2 Implement API key generation and management
    - Create secure API key generation using crypto/rand
    - Add API key validation and authentication middleware
    - Implement key rotation functionality with backward compatibility
    - _Requirements: 1.3, 4.3_

  - [ ] 3.3 Implement gateway configuration generation
    - Create HTTPRoute configuration templates for traditional models
    - Create AIGatewayRoute configuration templates for OpenAI models
    - Add tenant-specific routing rules and path mappings
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ] 3.4 Implement rate limiting policy creation
    - Create BackendTrafficPolicy templates with token bucket configuration
    - Add configurable rate limits (requests per minute/hour, token limits)
    - Implement tenant-specific and model-specific quota enforcement
    - _Requirements: 3.1, 3.2, 3.4_

- [ ] 4. Add publishing API endpoints to management server
  - [ ] 4.1 Add model publishing endpoints to `management/server.go`
    - POST /api/models/:modelName/publish - Publish model for external access
    - DELETE /api/models/:modelName/publish - Unpublish model
    - GET /api/models/:modelName/publish - Get published model details
    - PUT /api/models/:modelName/publish - Update published model configuration
    - _Requirements: 1.1, 1.2, 4.1, 4.4_

  - [ ] 4.2 Add API key management endpoints
    - POST /api/models/:modelName/publish/rotate-key - Rotate API key
    - GET /api/published-models - List all published models by tenant
    - Add proper authentication and authorization for publishing operations
    - _Requirements: 4.2, 4.3_

  - [ ] 4.3 Implement publishing request validation
    - Validate InferenceService exists and is ready before publishing
    - Check tenant permissions and resource quotas
    - Validate rate limiting configuration parameters
    - _Requirements: 1.1, 3.4_

- [ ] 5. Create publishing workflow orchestration
  - [ ] 5.1 Implement PublishModel method
    - Orchestrate complete model publishing workflow
    - Handle both traditional and OpenAI model types
    - Create gateway routes, rate limiting policies, and API keys
    - Add rollback mechanisms for failed publishing operations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 5.2 Implement UnpublishModel method
    - Clean removal of gateway routes and API access
    - Revoke API keys and remove rate limiting policies
    - Maintain data integrity during unpublishing process
    - _Requirements: 4.4_

  - [ ] 5.3 Implement UpdatePublishedModel method
    - Support updating access controls without service interruption
    - Handle rate limiting configuration changes
    - Maintain published endpoints during updates
    - _Requirements: 4.2, 4.4_

- [-] 6. Add monitoring and usage tracking
  - [ ] 6.1 Implement usage statistics collection
    - Track API requests, tokens used, and access patterns per published model
    - Add metrics for rate limit violations and authentication failures
    - Store usage data for analytics and reporting
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.2 Add audit logging for publishing operations
    - Log all publishing, unpublishing, and key rotation events
    - Include tenant, user, and model information in audit logs
    - Add security event logging for unauthorized access attempts
    - _Requirements: 6.1, 6.3_

- [x] 7. Create React UI components for publishing
  - [x] 7.1 Create PublishingForm component
    - Build form for configuring model publishing settings
    - Add rate limiting configuration options
    - Include tenant selection and access control settings
    - _Requirements: 1.1, 3.1, 3.4_

  - [x] 7.2 Create PublishedModelsList component
    - Display list of published models with status and usage metrics
    - Add management actions (unpublish, update, rotate keys)
    - Show API endpoint information and documentation
    - _Requirements: 4.1, 4.2, 5.1_

  - [x] 7.3 Create APIKeyManager component
    - Display API keys with copy-to-clipboard functionality
    - Add key rotation interface with confirmation dialogs
    - Show key usage statistics and last access times
    - _Requirements: 4.3, 5.1_

  - [x] 7.4 Extend ModelList component with publish actions
    - Add "Publish" button to model list items
    - Show publishing status indicators
    - Add quick access to published model endpoints
    - _Requirements: 1.1, 5.1_

- [ ] 8. Add API documentation generation
  - [ ] 8.1 Implement automatic documentation generation
    - Generate API documentation with endpoint URLs and authentication details
    - Create code examples for common programming languages
    - Add OpenAI-compatible client examples for OpenAI models
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 8.2 Create SDK examples and client libraries
    - Provide HTTP request examples with proper headers
    - Add rate limiting documentation and error handling approaches
    - Create language-specific SDK examples (Python, JavaScript, curl)
    - _Requirements: 5.2, 5.4, 5.5_

- [-] 9. Implement comprehensive error handling
  - [ ] 9.1 Add publishing validation errors
    - Handle model not found, not ready, and invalid tenant scenarios
    - Add gateway configuration failure handling
    - Implement API key generation failure recovery
    - _Requirements: 1.1, 1.3_

  - [ ] 9.2 Add rollback mechanisms
    - Automatic cleanup of partially created resources on failure
    - Rollback gateway configurations if publishing fails
    - Preserve existing configurations during updates
    - _Requirements: 1.1, 1.2, 4.4_

- [ ] 10. Add comprehensive testing
  - [ ] 10.1 Create unit tests for publishing service
    - Test model type detection logic
    - Test API key generation and validation
    - Test gateway configuration generation
    - Test rate limiting policy creation
    - _Requirements: All requirements_

  - [ ] 10.2 Create integration tests for publishing workflow
    - Test complete model publishing flow from UI to gateway
    - Test API key authentication and authorization
    - Test rate limiting enforcement
    - Test multi-tenant isolation verification
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

  - [ ] 10.3 Create API endpoint tests
    - Test all publishing API endpoints with various configurations
    - Test error scenarios and validation
    - Test authentication and authorization
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 11. Add security and performance optimizations
  - [ ] 11.1 Implement security best practices
    - Add API key encryption in Kubernetes secrets
    - Implement tenant isolation validation
    - Add rate limiting security measures
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 11.2 Optimize performance for scale
    - Implement efficient API key validation with caching
    - Optimize gateway route resolution
    - Add connection pooling for backend services
    - _Requirements: 3.1, 3.2_