package main

import (
	"os"
)

type Config struct {
	Port               string
	NodeEnv            string
	SuperAdminUsername string
	SuperAdminPassword string
	ValidTenants       []string
	SupportedFrameworks []Framework
}

type Framework struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func NewConfig() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		NodeEnv:            getEnv("NODE_ENV", "production"),
		SuperAdminUsername: getEnv("SUPER_ADMIN_USERNAME", "admin"),
		SuperAdminPassword: getEnv("SUPER_ADMIN_PASSWORD", "admin123"),
		ValidTenants:       []string{"tenant-a", "tenant-b", "tenant-c"},
		SupportedFrameworks: []Framework{
			{Name: "sklearn", Description: "Scikit-learn models"},
			{Name: "tensorflow", Description: "TensorFlow models"},
			{Name: "pytorch", Description: "PyTorch models"},
			{Name: "onnx", Description: "ONNX models"},
			{Name: "xgboost", Description: "XGBoost models"},
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) IsValidTenant(tenant string) bool {
	for _, validTenant := range c.ValidTenants {
		if validTenant == tenant {
			return true
		}
	}
	return false
}

func (c *Config) IsValidFramework(framework string) bool {
	for _, supportedFramework := range c.SupportedFrameworks {
		if supportedFramework.Name == framework {
			return true
		}
	}
	return false
}