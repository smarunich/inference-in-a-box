package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

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


	// Get Gateway API gateways
	gateways, err := s.k8sClient.GetGateways("")
	if err != nil {
		// Log error but continue - Gateway API might not be installed
		log.Printf("Error getting gateways: %v", err)
		gateways = []map[string]interface{}{}
	}

	// Get Gateway API HTTPRoutes
	httpRoutes, err := s.k8sClient.GetHTTPRoutes("")
	if err != nil {
		// Log error but continue - Gateway API might not be installed
		httpRoutes = []map[string]interface{}{}
	}

	// Get Istio VirtualServices
	virtualServices, err := s.k8sClient.GetVirtualServices("")
	if err != nil {
		// Log error but continue - Istio might not be installed
		virtualServices = []map[string]interface{}{}
	}

	// Get Istio Gateways
	istioGateways, err := s.k8sClient.GetIstioGateways("")
	if err != nil {
		// Log error but continue - Istio might not be installed
		istioGateways = []map[string]interface{}{}
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


	// Convert Gateway API gateways to response format
	var gatewayInfos []GatewayInfo
	for _, gateway := range gateways {
		metadata := gateway["metadata"].(map[string]interface{})
		spec := gateway["spec"].(map[string]interface{})
		
		var listeners []string
		var addresses []string
		
		if listenersData, ok := spec["listeners"].([]interface{}); ok {
			for _, listener := range listenersData {
				if l, ok := listener.(map[string]interface{}); ok {
					name := l["name"].(string)
					var port int64
					switch p := l["port"].(type) {
					case int64:
						port = p
					case float64:
						port = int64(p)
					}
					protocol := l["protocol"].(string)
					listeners = append(listeners, fmt.Sprintf("%s:%d/%s", name, port, protocol))
				}
			}
		}
		
		if status, ok := gateway["status"].(map[string]interface{}); ok {
			if addressesData, ok := status["addresses"].([]interface{}); ok {
				for _, addr := range addressesData {
					if a, ok := addr.(map[string]interface{}); ok {
						if value, ok := a["value"].(string); ok {
							addresses = append(addresses, value)
						}
					}
				}
			}
		}
		
		gatewayClass := ""
		if gc, ok := spec["gatewayClassName"].(string); ok {
			gatewayClass = gc
		}
		
		gatewayInfos = append(gatewayInfos, GatewayInfo{
			Name:         metadata["name"].(string),
			Namespace:    metadata["namespace"].(string),
			GatewayClass: gatewayClass,
			Listeners:    listeners,
			Addresses:    addresses,
			CreatedAt:    parseTime(metadata["creationTimestamp"].(string)),
		})
	}

	// Convert HTTPRoutes to response format
	var httpRouteInfos []HTTPRouteInfo
	for _, route := range httpRoutes {
		metadata := route["metadata"].(map[string]interface{})
		spec := route["spec"].(map[string]interface{})
		
		var hostnames []string
		var parentRefs []string
		
		if hostnamesData, ok := spec["hostnames"].([]interface{}); ok {
			for _, hostname := range hostnamesData {
				hostnames = append(hostnames, hostname.(string))
			}
		}
		
		if parentRefsData, ok := spec["parentRefs"].([]interface{}); ok {
			for _, parentRef := range parentRefsData {
				if pr, ok := parentRef.(map[string]interface{}); ok {
					name := pr["name"].(string)
					namespace := ""
					if ns, ok := pr["namespace"].(string); ok {
						namespace = ns
					}
					if namespace != "" {
						parentRefs = append(parentRefs, fmt.Sprintf("%s/%s", namespace, name))
					} else {
						parentRefs = append(parentRefs, name)
					}
				}
			}
		}
		
		httpRouteInfos = append(httpRouteInfos, HTTPRouteInfo{
			Name:       metadata["name"].(string),
			Namespace:  metadata["namespace"].(string),
			Hostnames:  hostnames,
			ParentRefs: parentRefs,
			CreatedAt:  parseTime(metadata["creationTimestamp"].(string)),
		})
	}

	// Convert VirtualServices to response format
	var virtualServiceInfos []VirtualServiceInfo
	for _, vs := range virtualServices {
		metadata := vs["metadata"].(map[string]interface{})
		spec := vs["spec"].(map[string]interface{})
		
		var hosts []string
		var gateways []string
		
		if hostsData, ok := spec["hosts"].([]interface{}); ok {
			for _, host := range hostsData {
				hosts = append(hosts, host.(string))
			}
		}
		
		if gatewaysData, ok := spec["gateways"].([]interface{}); ok {
			for _, gateway := range gatewaysData {
				gateways = append(gateways, gateway.(string))
			}
		}
		
		virtualServiceInfos = append(virtualServiceInfos, VirtualServiceInfo{
			Name:      metadata["name"].(string),
			Namespace: metadata["namespace"].(string),
			Hosts:     hosts,
			Gateways:  gateways,
			CreatedAt: parseTime(metadata["creationTimestamp"].(string)),
		})
	}

	// Convert Istio Gateways to response format
	var istioGatewayInfos []IstioGatewayInfo
	for _, ig := range istioGateways {
		metadata := ig["metadata"].(map[string]interface{})
		spec := ig["spec"].(map[string]interface{})
		
		var servers []string
		selector := make(map[string]string)
		
		if serversData, ok := spec["servers"].([]interface{}); ok {
			for _, server := range serversData {
				if s, ok := server.(map[string]interface{}); ok {
					port := s["port"].(map[string]interface{})
					var number int64
					switch n := port["number"].(type) {
					case int64:
						number = n
					case float64:
						number = int64(n)
					}
					protocol := port["protocol"].(string)
					hosts := s["hosts"].([]interface{})
					for _, host := range hosts {
						servers = append(servers, fmt.Sprintf("%s:%d/%s", host.(string), number, protocol))
					}
				}
			}
		}
		
		if selectorData, ok := spec["selector"].(map[string]interface{}); ok {
			for k, v := range selectorData {
				selector[k] = v.(string)
			}
		}
		
		istioGatewayInfos = append(istioGatewayInfos, IstioGatewayInfo{
			Name:      metadata["name"].(string),
			Namespace: metadata["namespace"].(string),
			Servers:   servers,
			Selector:  selector,
			CreatedAt: parseTime(metadata["creationTimestamp"].(string)),
		})
	}


	c.JSON(http.StatusOK, AdminResourcesResponse{
		Pods:            podInfos,
		Services:        serviceInfos,
		Gateways:        gatewayInfos,
		HTTPRoutes:      httpRouteInfos,
		VirtualServices: virtualServiceInfos,
		IstioGateways:   istioGatewayInfos,
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

// GetAIGatewayService handles GET /api/admin/ai-gateway-service
func (s *AdminService) GetAIGatewayService(c *gin.Context) {
	// Get the AI Gateway service (EnvoyGateway service)
	services, err := s.k8sClient.GetServices("envoy-gateway-system")
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get services",
			Details: err.Error(),
		})
		return
	}

	// Find the gateway service
	var gatewayService *corev1.Service
	for _, service := range services {
		if service.Name == "envoy-gateway" {
			gatewayService = &service
			break
		}
	}

	if gatewayService == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error: "AI Gateway service not found",
		})
		return
	}

	// Extract service information
	serviceInfo := map[string]interface{}{
		"name":      gatewayService.Name,
		"namespace": gatewayService.Namespace,
		"type":      string(gatewayService.Spec.Type),
		"clusterIP": gatewayService.Spec.ClusterIP,
		"ports":     gatewayService.Spec.Ports,
	}

	// Add external IP if available
	if len(gatewayService.Status.LoadBalancer.Ingress) > 0 {
		ingress := gatewayService.Status.LoadBalancer.Ingress[0]
		if ingress.IP != "" {
			serviceInfo["externalIP"] = ingress.IP
		}
		if ingress.Hostname != "" {
			serviceInfo["externalHostname"] = ingress.Hostname
		}
	}

	c.JSON(http.StatusOK, serviceInfo)
}

// Helper function to convert resource list to map
func convertResourceList(resources corev1.ResourceList) map[string]interface{} {
	result := make(map[string]interface{})
	for key, value := range resources {
		result[string(key)] = value.String()
	}
	return result
}

// Helper function to parse time from string
func parseTime(timeStr string) time.Time {
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return time.Time{}
	}
	return t
}