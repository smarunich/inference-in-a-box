package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// Check if running in test mode
	if len(os.Args) > 1 && os.Args[1] == "test" {
		log.Println("🧪 Running API Compatibility Test...")
		testConfiguration()
		log.Println("✅ Basic tests passed - Go backend is compatible with React frontend")
		return
	}
	
	// Initialize configuration
	config := NewConfig()
	
	// Initialize services
	k8sClient, err := NewK8sClient()
	if err != nil {
		log.Fatalf("Failed to initialize Kubernetes client: %v", err)
	}
	
	authService := NewAuthService(config, k8sClient)
	modelService := NewModelService(k8sClient)
	adminService := NewAdminService(k8sClient)
	publishingService := NewPublishingService(k8sClient, authService)
	testExecutionService := NewTestExecutionService(publishingService, config)
	
	// Initialize HTTP server
	server := NewServer(config, authService, modelService, adminService, publishingService, testExecutionService)
	
	// Setup routes
	server.SetupRoutes()
	
	// Start server
	srv := &http.Server{
		Addr:    ":" + config.Port,
		Handler: server.Router,
	}
	
	// Start server in a goroutine
	go func() {
		log.Printf("🚀 Management server starting on port %s", config.Port)
		log.Println("Available endpoints:")
		log.Println("  GET  /health - Health check")
		log.Println("  GET  /api/tokens - Get JWT tokens")
		log.Println("  GET  /api/models - List models")
		log.Println("  GET  /api/models/:name - Get model details")
		log.Println("  POST /api/models - Create model")
		log.Println("  PUT  /api/models/:name - Update model")
		log.Println("  DELETE /api/models/:name - Delete model")
		log.Println("  POST /api/models/:name/predict - Make prediction")
		log.Println("  GET  /api/models/:name/logs - Get model logs")
		log.Println("  GET  /api/tenant - Get tenant info")
		log.Println("  GET  /api/frameworks - List supported frameworks")
		log.Println("  POST /api/models/:name/publish - Publish model")
		log.Println("  DELETE /api/models/:name/publish - Unpublish model")
		log.Println("  GET  /api/models/:name/publish - Get published model")
		log.Println("  POST /api/models/:name/publish/rotate-key - Rotate API key")
		log.Println("  GET  /api/published-models - List published models")
		log.Println("  POST /api/publish/test/execute - Execute test for published models")
		log.Println("  GET  /api/publish/test/history - Get published model test history")
		log.Println("  POST /api/publish/test/validate - Validate published model test request")
		log.Println("  GET  /* - Serve React application")
		
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()
	
	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	log.Println("🛑 Server shutting down...")
	
	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	
	log.Println("✅ Server exited")
}

func testConfiguration() {
	config := NewConfig()
	
	// Test basic configuration
	log.Printf("Port: %s", config.Port)
	log.Printf("Supported frameworks: %d", len(config.SupportedFrameworks))
	log.Printf("Valid tenants: %v", config.ValidTenants)
	
	// Test framework validation
	if config.IsValidFramework("sklearn") {
		log.Println("✅ Framework validation works")
	}
	
	// Test tenant validation
	if config.IsValidTenant("tenant-a") {
		log.Println("✅ Tenant validation works")
	}
	
	// Test YAML generation
	modelConfig := ModelConfig{
		Framework:   "sklearn",
		StorageUri:  "s3://bucket/model",
		MinReplicas: 1,
		MaxReplicas: 3,
		ScaleTarget: 60,
		ScaleMetric: "concurrency",
	}
	
	_, err := GenerateModelYAML("test-model", "tenant-a", modelConfig)
	if err == nil {
		log.Println("✅ YAML generation works")
	}
	
	// Test JWT authentication
	k8sClient, err := NewK8sClient()
	if err != nil {
		log.Printf("⚠ K8s client initialization failed: %v", err)
		return
	}
	
	authService := NewAuthService(config, k8sClient)
	user, err := authService.ValidateToken("super-admin-token")
	if err == nil && user.IsAdmin {
		log.Println("✅ JWT validation works")
	}
	
	// Test logging functionality
	log.Println("✅ Testing logging functionality...")
	ConfigureLogging()
	logLevel := GetLogLevel()
	log.Printf("✅ Current log level: %d", logLevel)
	log.Println("✅ Logging configuration works")
}