package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
)

type AdminService struct {
	k8sClient *K8sClient
	config    *Config
}

func NewAdminService(k8sClient *K8sClient) *AdminService {
	return &AdminService{
		k8sClient: k8sClient,
		config:    NewConfig(),
	}
}

// GetSystemInfo handles GET /api/admin/system
func (s *AdminService) GetSystemInfo(c *gin.Context) {
	// Get nodes
	nodes, err := s.k8sClient.GetNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get nodes",
			Details: err.Error(),
		})
		return
	}

	// Get namespaces
	namespaces, err := s.k8sClient.GetNamespaces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get namespaces",
			Details: err.Error(),
		})
		return
	}

	// Get deployments
	deployments, err := s.k8sClient.GetDeployments("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get deployments",
			Details: err.Error(),
		})
		return
	}

	// Convert to response format
	var nodeInfos []NodeInfo
	for _, node := range nodes {
		nodeInfo := NodeInfo{
			Name:        node.Name,
			Version:     node.Status.NodeInfo.KubeletVersion,
			Capacity:    convertResourceList(node.Status.Capacity),
			Allocatable: convertResourceList(node.Status.Allocatable),
		}

		// Find Ready condition
		nodeInfo.Status = "Unknown"
		for _, condition := range node.Status.Conditions {
			if condition.Type == corev1.NodeReady {
				if condition.Status == corev1.ConditionTrue {
					nodeInfo.Status = "Ready"
				} else {
					nodeInfo.Status = "NotReady"
				}
				break
			}
		}

		nodeInfos = append(nodeInfos, nodeInfo)
	}

	var namespaceInfos []NamespaceInfo
	for _, ns := range namespaces {
		namespaceInfos = append(namespaceInfos, NamespaceInfo{
			Name:      ns.Name,
			Status:    string(ns.Status.Phase),
			CreatedAt: ns.CreationTimestamp.Time,
		})
	}

	var deploymentInfos []DeploymentInfo
	for _, deployment := range deployments {
		deploymentInfos = append(deploymentInfos, DeploymentInfo{
			Name:      deployment.Name,
			Namespace: deployment.Namespace,
			Ready:     deployment.Status.ReadyReplicas,
			Replicas:  deployment.Status.Replicas,
			Available: deployment.Status.AvailableReplicas,
		})
	}

	c.JSON(http.StatusOK, AdminSystemResponse{
		Nodes:       nodeInfos,
		Namespaces:  namespaceInfos,
		Deployments: deploymentInfos,
	})
}

// GetTenants handles GET /api/admin/tenants
func (s *AdminService) GetTenants(c *gin.Context) {
	// Get namespaces
	namespaces, err := s.k8sClient.GetNamespaces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get namespaces",
			Details: err.Error(),
		})
		return
	}

	// Filter for tenant namespaces
	var tenants []NamespaceInfo
	for _, ns := range namespaces {
		if s.config.IsValidTenant(ns.Name) {
			tenants = append(tenants, NamespaceInfo{
				Name:      ns.Name,
				Status:    string(ns.Status.Phase),
				CreatedAt: ns.CreationTimestamp.Time,
			})
		}
	}

	c.JSON(http.StatusOK, AdminTenantsResponse{
		Tenants: tenants,
	})
}

// GetResources handles GET /api/admin/resources
func (s *AdminService) GetResources(c *gin.Context) {
	// Get pods
	pods, err := s.k8sClient.GetPods("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get pods",
			Details: err.Error(),
		})
		return
	}

	// Get services
	services, err := s.k8sClient.GetServices("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get services",
			Details: err.Error(),
		})
		return
	}

	// Get ingresses
	ingresses, err := s.k8sClient.GetIngresses("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get ingresses",
			Details: err.Error(),
		})
		return
	}

	// Convert to response format
	var podInfos []PodInfo
	for _, pod := range pods {
		podInfo := PodInfo{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    string(pod.Status.Phase),
			CreatedAt: pod.CreationTimestamp.Time,
		}

		// Calculate readiness and restarts
		ready := true
		restarts := int32(0)
		if pod.Status.ContainerStatuses != nil {
			for _, containerStatus := range pod.Status.ContainerStatuses {
				if !containerStatus.Ready {
					ready = false
				}
				restarts += containerStatus.RestartCount
			}
		}
		podInfo.Ready = ready
		podInfo.Restarts = restarts

		podInfos = append(podInfos, podInfo)
	}

	var serviceInfos []ServiceInfo
	for _, service := range services {
		var ports []map[string]interface{}
		for _, port := range service.Spec.Ports {
			portInfo := map[string]interface{}{
				"name":       port.Name,
				"port":       port.Port,
				"targetPort": port.TargetPort.String(),
				"protocol":   string(port.Protocol),
			}
			if port.NodePort != 0 {
				portInfo["nodePort"] = port.NodePort
			}
			ports = append(ports, portInfo)
		}

		serviceInfos = append(serviceInfos, ServiceInfo{
			Name:      service.Name,
			Namespace: service.Namespace,
			Type:      string(service.Spec.Type),
			ClusterIP: service.Spec.ClusterIP,
			Ports:     ports,
		})
	}

	var ingressInfos []IngressInfo
	for _, ingress := range ingresses {
		var hosts []string
		if ingress.Spec.Rules != nil {
			for _, rule := range ingress.Spec.Rules {
				hosts = append(hosts, rule.Host)
			}
		}

		ingressInfos = append(ingressInfos, IngressInfo{
			Name:      ingress.Name,
			Namespace: ingress.Namespace,
			Hosts:     hosts,
			CreatedAt: ingress.CreationTimestamp.Time,
		})
	}

	c.JSON(http.StatusOK, AdminResourcesResponse{
		Pods:      podInfos,
		Services:  serviceInfos,
		Ingresses: ingressInfos,
	})
}

// GetLogs handles GET /api/admin/logs
func (s *AdminService) GetLogs(c *gin.Context) {
	namespace := c.Query("namespace")
	component := c.Query("component")
	linesParam := c.Query("lines")

	lines := 100
	if linesParam != "" {
		if parsedLines, err := strconv.Atoi(linesParam); err == nil {
			lines = parsedLines
		}
	}

	// Get system logs
	logs, err := s.k8sClient.GetSystemLogs(namespace, component, lines)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get logs",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LogsResponse{
		Logs: logs,
	})
}

// ExecuteKubectl handles POST /api/admin/kubectl
func (s *AdminService) ExecuteKubectl(c *gin.Context) {
	var req KubectlRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	// Execute kubectl command
	result, err := s.k8sClient.ExecuteKubectlCommand(req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Command execution failed",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, KubectlResponse{
		Result:  result,
		Command: "kubectl " + req.Command,
	})
}

// Helper function to convert resource list to map
func convertResourceList(resources corev1.ResourceList) map[string]interface{} {
	result := make(map[string]interface{})
	for key, value := range resources {
		result[string(key)] = value.String()
	}
	return result
}