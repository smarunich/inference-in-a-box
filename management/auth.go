package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AuthService struct {
	config    *Config
	k8sClient *K8sClient
}

func NewAuthService(config *Config, k8sClient *K8sClient) *AuthService {
	return &AuthService{
		config:    config,
		k8sClient: k8sClient,
	}
}

// AuthMiddleware validates JWT tokens and sets user context
func (s *AuthService) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "Access token required",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "Invalid authorization format",
			})
			c.Abort()
			return
		}

		user, err := s.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: "Invalid token",
			})
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

// RequireAdmin middleware ensures user has admin privileges
func (s *AuthService) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error: "Authentication required",
			})
			c.Abort()
			return
		}

		u, ok := user.(*User)
		if !ok || !u.IsAdmin {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error: "Admin access required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ValidateToken validates and parses JWT token
func (s *AuthService) ValidateToken(tokenString string) (*User, error) {
	// Handle super admin token
	if tokenString == "super-admin-token" {
		return &User{
			Tenant:    "admin",
			Name:      "Super Admin",
			IsAdmin:   true,
			ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
		}, nil
	}

	// Parse JWT token without verification (matching Node.js behavior)
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Extract tenant information
	tenant, ok := claims["tenant"].(string)
	if !ok || tenant == "" {
		return nil, fmt.Errorf("invalid or missing tenant claim")
	}

	user := &User{
		Tenant:  tenant,
		IsAdmin: false,
	}

	// Extract optional fields
	if name, ok := claims["name"].(string); ok {
		user.Name = name
	}
	if sub, ok := claims["sub"].(string); ok {
		user.Subject = sub
	}
	if iss, ok := claims["iss"].(string); ok {
		user.Issuer = iss
	}
	if aud, ok := claims["aud"].(string); ok {
		user.Audience = aud
	}
	if exp, ok := claims["exp"].(float64); ok {
		user.ExpiresAt = int64(exp)
	}

	return user, nil
}

// AdminLogin handles super admin login
func (s *AuthService) AdminLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	if req.Username == s.config.SuperAdminUsername && req.Password == s.config.SuperAdminPassword {
		response := LoginResponse{
			Token: "super-admin-token",
			User: User{
				Tenant:  "admin",
				Name:    "Super Admin",
				IsAdmin: true,
			},
		}
		c.JSON(http.StatusOK, response)
	} else {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Invalid credentials",
		})
	}
}

// GetTokens proxies to existing JWT server
func (s *AuthService) GetTokens(c *gin.Context) {
	// Execute kubectl port-forward and curl command
	cmd := `kubectl port-forward -n default svc/jwt-server 8081:8080 > /dev/null 2>&1 & sleep 2 && curl -s http://localhost:8081/tokens && pkill -f "kubectl port-forward.*jwt-server"`
	
	result, err := ExecuteCommand(cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to retrieve tokens",
			Details: err.Error(),
		})
		return
	}

	// Parse JSON response
	var tokens interface{}
	if err := json.Unmarshal([]byte(result), &tokens); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to parse tokens response",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// EnhancedAuthMiddleware validates both JWT tokens and API keys
func (s *AuthService) EnhancedAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		
		if authHeader != "" {
			if strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				
				// Try JWT first (for management UI)
				if user, err := s.ValidateToken(token); err == nil {
					c.Set("user", user)
					c.Set("auth_type", "jwt")
					c.Next()
					return
				}
				
				// Try API key (for published models)
				if user, err := s.ValidateAPIKey(token); err == nil {
					c.Set("user", user)
					c.Set("auth_type", "apikey")
					c.Next()
					return
				}
			}
		}
		
		// Check X-API-Key header for API key auth
		if apiKey := c.GetHeader("X-API-Key"); apiKey != "" {
			if user, err := s.ValidateAPIKey(apiKey); err == nil {
				c.Set("user", user)
				c.Set("auth_type", "apikey")
				c.Next()
				return
			}
		}
		
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Invalid authentication",
		})
		c.Abort()
	}
}

// ValidateAPIKey validates API key and returns user context
func (s *AuthService) ValidateAPIKey(apiKey string) (*User, error) {
	if s.k8sClient == nil {
		return nil, fmt.Errorf("k8s client not initialized")
	}
	
	// Get all API key secrets across all namespaces
	metadata, err := s.findAPIKeyMetadata(apiKey)
	if err != nil {
		return nil, err
	}
	
	if !metadata.IsActive {
		return nil, fmt.Errorf("API key is inactive")
	}
	
	// Check if API key is expired
	if !metadata.ExpiresAt.IsZero() && time.Now().After(metadata.ExpiresAt) {
		return nil, fmt.Errorf("API key has expired")
	}
	
	// Create user context from API key metadata
	user := &User{
		Tenant:    metadata.TenantID,
		Name:      fmt.Sprintf("API Key User (%s)", metadata.ModelName),
		Subject:   metadata.KeyID,
		IsAdmin:   false,
		ExpiresAt: metadata.ExpiresAt.Unix(),
	}
	
	return user, nil
}

// findAPIKeyMetadata searches for API key metadata in all namespaces
func (s *AuthService) findAPIKeyMetadata(apiKey string) (*APIKeyMetadata, error) {
	// Search for API key across all namespaces
	namespaces := []string{"tenant-a", "tenant-b", "tenant-c"}
	
	for _, namespace := range namespaces {
		// Get all API key secrets in this namespace
		secrets, err := s.k8sClient.ListAPIKeySecrets(namespace)
		if err != nil {
			continue
		}
		
		for _, secret := range secrets {
			// Check if this secret contains the API key
			if storedKey, ok := secret["apiKey"].(string); ok && storedKey == apiKey {
				// Found matching API key, construct metadata
				metadata := &APIKeyMetadata{
					Namespace: namespace,
					IsActive:  true,
				}
				
				if keyID, ok := secret["keyId"].(string); ok {
					metadata.KeyID = keyID
				}
				if modelName, ok := secret["modelName"].(string); ok {
					metadata.ModelName = modelName
				}
				if tenantID, ok := secret["tenantId"].(string); ok {
					metadata.TenantID = tenantID
				}
				if modelType, ok := secret["modelType"].(string); ok {
					metadata.ModelType = modelType
				}
				if createdAt, ok := secret["createdAt"].(string); ok {
					if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
						metadata.CreatedAt = t
					}
				}
				if expiresAt, ok := secret["expiresAt"].(string); ok {
					if t, err := time.Parse(time.RFC3339, expiresAt); err == nil {
						metadata.ExpiresAt = t
					}
				}
				if permissions, ok := secret["permissions"].(string); ok {
					metadata.Permissions = strings.Split(permissions, ",")
				}
				if isActive, ok := secret["isActive"].(string); ok {
					metadata.IsActive = isActive == "true"
				}
				
				return metadata, nil
			}
		}
	}
	
	return nil, fmt.Errorf("API key not found")
}

// GetTenantInfo returns current user's tenant information
func (s *AuthService) GetTenantInfo(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error: "Authentication required",
		})
		return
	}

	u, ok := user.(*User)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Invalid user context",
		})
		return
	}

	var expiresAt string
	if u.ExpiresAt > 0 {
		expiresAt = time.Unix(u.ExpiresAt, 0).Format(time.RFC3339)
	}

	response := TenantResponse{
		Tenant:    u.Tenant,
		User:      u.Name,
		Issuer:    u.Issuer,
		Audience:  u.Audience,
		ExpiresAt: expiresAt,
	}

	// Use subject as fallback for user name
	if response.User == "" {
		response.User = u.Subject
	}

	c.JSON(http.StatusOK, response)
}