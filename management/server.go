package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

type Server struct {
	Router            *gin.Engine
	config            *Config
	authService       *AuthService
	modelService      *ModelService
	adminService      *AdminService
	publishingService *PublishingService
}

func NewServer(config *Config, authService *AuthService, modelService *ModelService, adminService *AdminService, publishingService *PublishingService) *Server {
	// Set Gin mode based on environment
	if config.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	
	// Configure logging
	ConfigureLogging()
	
	// Add middleware based on log level
	logLevel := GetLogLevel()
	switch logLevel {
	case LogLevelDetailed, LogLevelDebug:
		// Detailed logging with request/response bodies
		router.Use(DetailedRequestResponseLogger())
		router.Use(gin.Recovery())
	default:
		// Basic logging
		router.Use(RequestResponseLogger())
		router.Use(gin.Recovery())
	}
	
	// Add request ID middleware for tracing
	router.Use(RequestIDMiddleware())
	
	// Add CORS middleware
	router.Use(corsMiddleware())
	
	return &Server{
		Router:            router,
		config:            config,
		authService:       authService,
		modelService:      modelService,
		adminService:      adminService,
		publishingService: publishingService,
	}
}

func (s *Server) SetupRoutes() {
	// Health check endpoint
	s.Router.GET("/health", s.healthCheck)

	// API routes
	api := s.Router.Group("/api")
	{
		// Public endpoints
		api.POST("/admin/login", s.authService.AdminLogin)
		api.GET("/tokens", s.authService.GetTokens)
		api.GET("/frameworks", s.modelService.GetFrameworks)
		api.POST("/validate-api-key", s.publishingService.ValidateAPIKey)

		// Protected endpoints
		protected := api.Group("/")
		protected.Use(s.authService.AuthMiddleware())
		{
			// Model management
			protected.GET("/models", s.modelService.ListModels)
			protected.GET("/models/:modelName", s.modelService.GetModel)
			protected.POST("/models", s.modelService.CreateModel)
			protected.PUT("/models/:modelName", s.modelService.UpdateModel)
			protected.DELETE("/models/:modelName", s.modelService.DeleteModel)
			protected.POST("/models/:modelName/predict", s.modelService.PredictModel)
			protected.GET("/models/:modelName/logs", s.modelService.GetModelLogs)

			// Model publishing
			protected.POST("/models/:modelName/publish", s.publishingService.PublishModel)
			protected.DELETE("/models/:modelName/publish", s.publishingService.UnpublishModel)
			protected.GET("/models/:modelName/publish", s.publishingService.GetPublishedModel)
			protected.POST("/models/:modelName/publish/rotate-key", s.publishingService.RotateAPIKey)
			protected.GET("/published-models", s.publishingService.ListPublishedModels)

			// User info
			protected.GET("/tenant", s.authService.GetTenantInfo)

			// Admin-only endpoints
			admin := protected.Group("/admin")
			admin.Use(s.authService.RequireAdmin())
			{
				admin.GET("/system", s.adminService.GetSystemInfo)
				admin.GET("/tenants", s.adminService.GetTenants)
				admin.GET("/resources", s.adminService.GetResources)
				admin.GET("/logs", s.adminService.GetLogs)
				admin.POST("/kubectl", s.adminService.ExecuteKubectl)
			}
		}
	}

	// Serve static files from React build
	s.Router.Static("/static", "./ui/build/static")
	s.Router.StaticFile("/manifest.json", "./ui/build/manifest.json")
	s.Router.StaticFile("/favicon.ico", "./ui/build/favicon.ico")

	// Serve React app for all other routes (SPA fallback)
	s.Router.NoRoute(func(c *gin.Context) {
		// Check if this is an API request
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: "API endpoint not found",
			})
			return
		}

		// Serve React app index.html
		c.File("./ui/build/index.html")
	})
}

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now().Format(time.RFC3339),
	})
}

// CORS middleware
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}

// Custom error handler middleware
func errorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Handle any errors that occurred during request processing
		if len(c.Errors) > 0 {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error: "Internal server error",
			})
		}
	}
}

// Request logging middleware
func requestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC3339),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}

// Security headers middleware
func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}

// Rate limiting middleware (basic implementation)
func rateLimiter() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Basic rate limiting can be implemented here
		// For production, consider using redis-based rate limiting
		c.Next()
	}
}

// Request timeout middleware
func timeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set a timeout for the request
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// Helper function to serve static files with proper caching
func serveStaticWithCache(urlPath, root string) gin.HandlerFunc {
	fileServer := http.StripPrefix(urlPath, http.FileServer(http.Dir(root)))
	
	return func(c *gin.Context) {
		file := c.Param("filepath")
		
		// Check if file exists
		if _, err := os.Stat(filepath.Join(root, file)); os.IsNotExist(err) {
			c.Status(http.StatusNotFound)
			return
		}
		
		// Set cache headers for static assets
		if filepath.Ext(file) == ".js" || filepath.Ext(file) == ".css" {
			c.Header("Cache-Control", "public, max-age=31536000") // 1 year
		} else {
			c.Header("Cache-Control", "public, max-age=3600") // 1 hour
		}
		
		fileServer.ServeHTTP(c.Writer, c.Request)
	}
}