package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

type K8sClient struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
}

// KServe InferenceService GVR
var InferenceServiceGVR = schema.GroupVersionResource{
	Group:    "serving.kserve.io",
	Version:  "v1beta1",
	Resource: "inferenceservices",
}

// Gateway API GVRs
var HTTPRouteGVR = schema.GroupVersionResource{
	Group:    "gateway.networking.k8s.io",
	Version:  "v1",
	Resource: "httproutes",
}

var AIGatewayRouteGVR = schema.GroupVersionResource{
	Group:    "aigateway.envoyproxy.io",
	Version:  "v1alpha1",
	Resource: "aigatewayroutes",
}

var BackendTrafficPolicyGVR = schema.GroupVersionResource{
	Group:    "gateway.envoyproxy.io",
	Version:  "v1alpha1",
	Resource: "backendtrafficpolicies",
}

var BackendGVR = schema.GroupVersionResource{
	Group:    "gateway.envoyproxy.io",
	Version:  "v1alpha1",
	Resource: "backends",
}

var AIServiceBackendGVR = schema.GroupVersionResource{
	Group:    "aigateway.envoyproxy.io",
	Version:  "v1alpha1",
	Resource: "aiservicebackends",
}

var ReferenceGrantGVR = schema.GroupVersionResource{
	Group:    "gateway.networking.k8s.io",
	Version:  "v1beta1",
	Resource: "referencegrants",
}

func NewK8sClient() (*K8sClient, error) {
	config, err := getK8sConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return &K8sClient{
		clientset:     clientset,
		dynamicClient: dynamicClient,
	}, nil
}

func getK8sConfig() (*rest.Config, error) {
	// Try in-cluster config first
	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	// Fallback to kubeconfig
	var kubeconfig string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	if envKubeconfig := os.Getenv("KUBECONFIG"); envKubeconfig != "" {
		kubeconfig = envKubeconfig
	}

	config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from kubeconfig: %w", err)
	}

	return config, nil
}

// GetInferenceServices retrieves inference services
func (k *K8sClient) GetInferenceServices(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	var result []map[string]interface{}
	
	if namespace == "" {
		// Get all inference services across all namespaces
		list, err := k.dynamicClient.Resource(InferenceServiceGVR).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list inference services: %w", err)
		}
		
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	} else {
		// Get inference services in specific namespace
		list, err := k.dynamicClient.Resource(InferenceServiceGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list inference services in namespace %s: %w", namespace, err)
		}
		
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	}
	
	return result, nil
}

// GetInferenceService retrieves a specific inference service
func (k *K8sClient) GetInferenceService(namespace, name string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	obj, err := k.dynamicClient.Resource(InferenceServiceGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get inference service %s/%s: %w", namespace, name, err)
	}
	
	return obj.Object, nil
}

// CreateInferenceService creates a new inference service
func (k *K8sClient) CreateInferenceService(namespace string, spec map[string]interface{}) error {
	// Create the resource using kubectl apply (to maintain consistency with Node.js version)
	yamlData, err := ToYAML(spec)
	if err != nil {
		return fmt.Errorf("failed to convert to YAML: %w", err)
	}
	
	tempFile := fmt.Sprintf("/tmp/model-%s-%d.yaml", spec["metadata"].(map[string]interface{})["name"], time.Now().UnixNano())
	if err := os.WriteFile(tempFile, []byte(yamlData), 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}
	defer os.Remove(tempFile)
	
	cmd := fmt.Sprintf("kubectl apply -f %s", tempFile)
	if _, err := ExecuteCommand(cmd); err != nil {
		return fmt.Errorf("failed to apply inference service: %w", err)
	}
	
	return nil
}

// UpdateInferenceService updates an existing inference service
func (k *K8sClient) UpdateInferenceService(namespace, name string, spec map[string]interface{}) error {
	// Same as create - kubectl apply handles updates
	return k.CreateInferenceService(namespace, spec)
}

// DeleteInferenceService deletes an inference service
func (k *K8sClient) DeleteInferenceService(namespace, name string) error {
	ctx := context.Background()
	
	err := k.dynamicClient.Resource(InferenceServiceGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete inference service %s/%s: %w", namespace, name, err)
	}
	
	return nil
}

// GetPods retrieves pods
func (k *K8sClient) GetPods(namespace string) ([]corev1.Pod, error) {
	ctx := context.Background()
	
	opts := metav1.ListOptions{}
	var pods *corev1.PodList
	var err error
	
	if namespace == "" {
		pods, err = k.clientset.CoreV1().Pods("").List(ctx, opts)
	} else {
		pods, err = k.clientset.CoreV1().Pods(namespace).List(ctx, opts)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}
	
	return pods.Items, nil
}

// GetPodsWithSelector retrieves pods with label selector
func (k *K8sClient) GetPodsWithSelector(namespace, selector string) ([]corev1.Pod, error) {
	ctx := context.Background()
	
	opts := metav1.ListOptions{LabelSelector: selector}
	pods, err := k.clientset.CoreV1().Pods(namespace).List(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to list pods with selector %s: %w", selector, err)
	}
	
	return pods.Items, nil
}

// GetPodLogs retrieves pod logs
func (k *K8sClient) GetPodLogs(namespace, podName string, lines int) (string, error) {
	ctx := context.Background()
	
	tailLines := int64(lines)
	opts := &corev1.PodLogOptions{
		TailLines: &tailLines,
	}
	
	req := k.clientset.CoreV1().Pods(namespace).GetLogs(podName, opts)
	logs, err := req.DoRaw(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get pod logs: %w", err)
	}
	
	return string(logs), nil
}

// GetNodes retrieves cluster nodes
func (k *K8sClient) GetNodes() ([]corev1.Node, error) {
	ctx := context.Background()
	
	nodes, err := k.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}
	
	return nodes.Items, nil
}

// GetNamespaces retrieves namespaces
func (k *K8sClient) GetNamespaces() ([]corev1.Namespace, error) {
	ctx := context.Background()
	
	namespaces, err := k.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}
	
	return namespaces.Items, nil
}

// GetDeployments retrieves deployments
func (k *K8sClient) GetDeployments(namespace string) ([]appsv1.Deployment, error) {
	ctx := context.Background()
	
	var deployments *appsv1.DeploymentList
	var err error
	
	if namespace == "" {
		deployments, err = k.clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	} else {
		deployments, err = k.clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}
	
	return deployments.Items, nil
}

// GetServices retrieves services
func (k *K8sClient) GetServices(namespace string) ([]corev1.Service, error) {
	ctx := context.Background()
	
	var services *corev1.ServiceList
	var err error
	
	if namespace == "" {
		services, err = k.clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	} else {
		services, err = k.clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}
	
	return services.Items, nil
}


// GetGateways retrieves Gateway API gateways
func (k *K8sClient) GetGateways(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// Gateway API Gateway GVR
	gatewayGVR := schema.GroupVersionResource{
		Group:    "gateway.networking.k8s.io",
		Version:  "v1",
		Resource: "gateways",
	}
	
	var result []map[string]interface{}
	
	if namespace == "" {
		list, err := k.dynamicClient.Resource(gatewayGVR).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list gateways: %w", err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	} else {
		list, err := k.dynamicClient.Resource(gatewayGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list gateways in namespace %s: %w", namespace, err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	}
	
	return result, nil
}

// GetHTTPRoutes retrieves Gateway API HTTPRoutes
func (k *K8sClient) GetHTTPRoutes(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// Gateway API HTTPRoute GVR
	httpRouteGVR := schema.GroupVersionResource{
		Group:    "gateway.networking.k8s.io",
		Version:  "v1",
		Resource: "httproutes",
	}
	
	var result []map[string]interface{}
	
	if namespace == "" {
		list, err := k.dynamicClient.Resource(httpRouteGVR).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list httproutes: %w", err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	} else {
		list, err := k.dynamicClient.Resource(httpRouteGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list httproutes in namespace %s: %w", namespace, err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	}
	
	return result, nil
}

// GetVirtualServices retrieves Istio VirtualServices
func (k *K8sClient) GetVirtualServices(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// Istio VirtualService GVR
	virtualServiceGVR := schema.GroupVersionResource{
		Group:    "networking.istio.io",
		Version:  "v1beta1",
		Resource: "virtualservices",
	}
	
	var result []map[string]interface{}
	
	if namespace == "" {
		list, err := k.dynamicClient.Resource(virtualServiceGVR).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list virtualservices: %w", err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	} else {
		list, err := k.dynamicClient.Resource(virtualServiceGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list virtualservices in namespace %s: %w", namespace, err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	}
	
	return result, nil
}

// GetIstioGateways retrieves Istio Gateways
func (k *K8sClient) GetIstioGateways(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// Istio Gateway GVR
	istioGatewayGVR := schema.GroupVersionResource{
		Group:    "networking.istio.io",
		Version:  "v1beta1",
		Resource: "gateways",
	}
	
	var result []map[string]interface{}
	
	if namespace == "" {
		list, err := k.dynamicClient.Resource(istioGatewayGVR).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list istio gateways: %w", err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	} else {
		list, err := k.dynamicClient.Resource(istioGatewayGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list istio gateways in namespace %s: %w", namespace, err)
		}
		for _, item := range list.Items {
			result = append(result, item.Object)
		}
	}
	
	return result, nil
}


// ExecuteKubectlCommand executes a kubectl command (admin only)
func (k *K8sClient) ExecuteKubectlCommand(command string) (string, error) {
	// Security check - only allow safe read operations
	safeCommands := []string{"get", "describe", "logs", "top"}
	commandParts := strings.Fields(command)
	
	if len(commandParts) == 0 {
		return "", fmt.Errorf("empty command")
	}
	
	allowed := false
	for _, safeCmd := range safeCommands {
		if commandParts[0] == safeCmd {
			allowed = true
			break
		}
	}
	
	if !allowed {
		return "", fmt.Errorf("only safe read operations are allowed")
	}
	
	fullCommand := fmt.Sprintf("kubectl %s", command)
	result, err := ExecuteCommand(fullCommand)
	if err != nil {
		return "", fmt.Errorf("command execution failed: %w", err)
	}
	
	return result, nil
}

// GetModelLogs retrieves logs for a specific model
func (k *K8sClient) GetModelLogs(namespace, modelName string, lines int) ([]string, error) {
	// Get pods for the inference service
	selector := fmt.Sprintf("serving.kserve.io/inferenceservice=%s", modelName)
	pods, err := k.GetPodsWithSelector(namespace, selector)
	if err != nil {
		return nil, fmt.Errorf("failed to get pods for model %s: %w", modelName, err)
	}
	
	if len(pods) == 0 {
		return []string{}, nil
	}
	
	// Get logs from the first pod (can be extended to aggregate from all pods)
	logs, err := k.GetPodLogs(namespace, pods[0].Name, lines)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs for pod %s: %w", pods[0].Name, err)
	}
	
	// Split logs into lines
	logLines := strings.Split(logs, "\n")
	
	// Filter out empty lines
	var result []string
	for _, line := range logLines {
		if strings.TrimSpace(line) != "" {
			result = append(result, line)
		}
	}
	
	return result, nil
}

// GetSystemLogs retrieves system logs
func (k *K8sClient) GetSystemLogs(namespace, component string, lines int) ([]string, error) {
	ctx := context.Background()
	var allLogs []string
	
	// Get all namespaces if namespace is empty
	namespaces := []string{namespace}
	if namespace == "" {
		nsList, err := k.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list namespaces: %w", err)
		}
		namespaces = make([]string, len(nsList.Items))
		for i, ns := range nsList.Items {
			namespaces[i] = ns.Name
		}
	}
	
	// For each namespace, get pods and their logs
	for _, ns := range namespaces {
		var pods *corev1.PodList
		var err error
		
		if component != "" {
			// Filter by label selector
			labelSelector := fmt.Sprintf("app=%s", component)
			pods, err = k.clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{
				LabelSelector: labelSelector,
			})
		} else {
			// Get all pods
			pods, err = k.clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
		}
		
		if err != nil {
			continue // Skip this namespace if we can't list pods
		}
		
		// Get logs from each pod
		for _, pod := range pods.Items {
			if pod.Status.Phase != corev1.PodRunning && pod.Status.Phase != corev1.PodSucceeded {
				continue // Skip pods that aren't running
			}
			
			// Get logs from each container in the pod
			for _, container := range pod.Spec.Containers {
				logOptions := &corev1.PodLogOptions{
					Container: container.Name,
					TailLines: func(i int64) *int64 { return &i }(int64(lines / len(pods.Items))), // Distribute lines across pods
				}
				
				logStream, err := k.clientset.CoreV1().Pods(pod.Namespace).GetLogs(pod.Name, logOptions).Stream(ctx)
				if err != nil {
					// Add error info but continue with other pods
					allLogs = append(allLogs, fmt.Sprintf("[ERROR] Failed to get logs from %s/%s/%s: %v", pod.Namespace, pod.Name, container.Name, err))
					continue
				}
				
				logBytes, err := io.ReadAll(logStream)
				logStream.Close()
				if err != nil {
					allLogs = append(allLogs, fmt.Sprintf("[ERROR] Failed to read logs from %s/%s/%s: %v", pod.Namespace, pod.Name, container.Name, err))
					continue
				}
				
				// Process log lines
				logContent := string(logBytes)
				if strings.TrimSpace(logContent) != "" {
					logLines := strings.Split(logContent, "\n")
					for _, line := range logLines {
						if strings.TrimSpace(line) != "" {
							// Prefix with pod info for clarity
							prefixedLine := fmt.Sprintf("[%s/%s/%s] %s", pod.Namespace, pod.Name, container.Name, line)
							allLogs = append(allLogs, prefixedLine)
						}
					}
				}
			}
		}
	}
	
	// Limit total number of log lines returned
	if len(allLogs) > lines {
		allLogs = allLogs[len(allLogs)-lines:]
	}
	
	return allLogs, nil
}

// Helper function to log errors
func (k *K8sClient) logError(operation string, err error) {
	log.Printf("K8s Client Error - %s: %v", operation, err)
}

// Gateway API Operations

// Removed duplicate HTTPRoute CRUD operations - using comprehensive versions later in file

func (k *K8sClient) GetHTTPRoute(namespace, name string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	// Get the HTTPRoute
	obj, err := k.dynamicClient.Resource(HTTPRouteGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		k.logError("GetHTTPRoute", err)
		return nil, fmt.Errorf("failed to get HTTPRoute: %w", err)
	}
	
	return obj.Object, nil
}

// Removed duplicate AIGatewayRoute CRUD operations - using comprehensive versions later in file

func (k *K8sClient) GetAIGatewayRoute(namespace, name string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	// Get the AIGatewayRoute
	obj, err := k.dynamicClient.Resource(AIGatewayRouteGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		k.logError("GetAIGatewayRoute", err)
		return nil, fmt.Errorf("failed to get AIGatewayRoute: %w", err)
	}
	
	return obj.Object, nil
}

// Removed duplicate BackendTrafficPolicy CRUD operations - using comprehensive versions later in file

func (k *K8sClient) GetBackendTrafficPolicy(namespace, name string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	// Get the BackendTrafficPolicy
	obj, err := k.dynamicClient.Resource(BackendTrafficPolicyGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		k.logError("GetBackendTrafficPolicy", err)
		return nil, fmt.Errorf("failed to get BackendTrafficPolicy: %w", err)
	}
	
	return obj.Object, nil
}

// Removed duplicate API Key Secret Management methods - using comprehensive versions later in file

// Published Model Metadata Management
func (k *K8sClient) CreatePublishedModelMetadata(namespace, modelName string, metadata map[string]interface{}) error {
	ctx := context.Background()
	
	configMapName := fmt.Sprintf("published-model-metadata-%s", modelName)
	
	// Convert metadata to JSON string
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        "published-model",
				"model-name": modelName,
				"type":       "metadata",
			},
		},
		Data: map[string]string{
			"metadata.json": string(metadataJSON),
		},
	}
	
	_, err = k.clientset.CoreV1().ConfigMaps(namespace).Create(ctx, configMap, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreatePublishedModelMetadata", err)
		return fmt.Errorf("failed to create published model metadata: %w", err)
	}
	
	return nil
}

func (k *K8sClient) UpdatePublishedModelMetadata(namespace, modelName string, metadata map[string]interface{}) error {
	ctx := context.Background()
	
	configMapName := fmt.Sprintf("published-model-metadata-%s", modelName)
	
	// Convert metadata to JSON string
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	
	// Get existing configmap
	configMap, err := k.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetPublishedModelMetadata", err)
		return fmt.Errorf("failed to get published model metadata: %w", err)
	}
	
	// Update the metadata
	configMap.Data["metadata.json"] = string(metadataJSON)
	
	_, err = k.clientset.CoreV1().ConfigMaps(namespace).Update(ctx, configMap, metav1.UpdateOptions{})
	if err != nil {
		k.logError("UpdatePublishedModelMetadata", err)
		return fmt.Errorf("failed to update published model metadata: %w", err)
	}
	
	return nil
}

func (k *K8sClient) GetPublishedModelMetadata(namespace, modelName string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	configMapName := fmt.Sprintf("published-model-metadata-%s", modelName)
	
	configMap, err := k.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetPublishedModelMetadata", err)
		return nil, fmt.Errorf("failed to get published model metadata: %w", err)
	}
	
	metadataJSON, exists := configMap.Data["metadata.json"]
	if !exists {
		return nil, fmt.Errorf("metadata.json not found in configmap")
	}
	
	var metadata map[string]interface{}
	if err := json.Unmarshal([]byte(metadataJSON), &metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}
	
	return metadata, nil
}

func (k *K8sClient) DeletePublishedModelMetadata(namespace, modelName string) error {
	ctx := context.Background()
	
	configMapName := fmt.Sprintf("published-model-metadata-%s", modelName)
	
	err := k.clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, configMapName, metav1.DeleteOptions{})
	if err != nil {
		k.logError("DeletePublishedModelMetadata", err)
		return fmt.Errorf("failed to delete published model metadata: %w", err)
	}
	
	return nil
}

// List all published models across namespaces
func (k *K8sClient) ListPublishedModels(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// List all configmaps with published model metadata label
	labelSelector := "app=published-model,type=metadata"
	
	var configMaps *corev1.ConfigMapList
	var err error
	
	if namespace == "" {
		// List across all namespaces
		configMaps, err = k.clientset.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
	} else {
		// List in specific namespace
		configMaps, err = k.clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
	}
	
	if err != nil {
		k.logError("ListPublishedModels", err)
		return nil, fmt.Errorf("failed to list published models: %w", err)
	}
	
	var publishedModels []map[string]interface{}
	
	for _, configMap := range configMaps.Items {
		metadataJSON, exists := configMap.Data["metadata.json"]
		if !exists {
			continue
		}
		
		var metadata map[string]interface{}
		if err := json.Unmarshal([]byte(metadataJSON), &metadata); err != nil {
			continue
		}
		
		publishedModels = append(publishedModels, metadata)
	}
	
	return publishedModels, nil
}

// API Key Secret Management
func (k *K8sClient) CreateAPIKeySecret(namespace, secretName string, secretData map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert secretData to string map for Kubernetes secret
	data := make(map[string][]byte)
	for key, value := range secretData {
		if str, ok := value.(string); ok {
			data[key] = []byte(str)
		} else if b, ok := value.(bool); ok {
			data[key] = []byte(fmt.Sprintf("%t", b))
		} else {
			data[key] = []byte(fmt.Sprintf("%v", value))
		}
	}
	
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":  "published-model",
				"type": "apikey",
			},
		},
		Data: data,
		Type: corev1.SecretTypeOpaque,
	}
	
	_, err := k.clientset.CoreV1().Secrets(namespace).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateAPIKeySecret", err)
		return fmt.Errorf("failed to create API key secret: %w", err)
	}
	
	return nil
}

func (k *K8sClient) GetAPIKeySecret(namespace, secretName string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	secret, err := k.clientset.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetAPIKeySecret", err)
		return nil, fmt.Errorf("failed to get API key secret: %w", err)
	}
	
	// Convert secret data to map[string]interface{}
	result := make(map[string]interface{})
	for key, value := range secret.Data {
		result[key] = string(value)
	}
	
	return result, nil
}

func (k *K8sClient) UpdateAPIKeySecret(namespace, secretName string, secretData map[string]interface{}) error {
	ctx := context.Background()
	
	// Get existing secret
	secret, err := k.clientset.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetAPIKeySecret", err)
		return fmt.Errorf("failed to get API key secret: %w", err)
	}
	
	// Update data
	for key, value := range secretData {
		if str, ok := value.(string); ok {
			secret.Data[key] = []byte(str)
		} else if b, ok := value.(bool); ok {
			secret.Data[key] = []byte(fmt.Sprintf("%t", b))
		} else {
			secret.Data[key] = []byte(fmt.Sprintf("%v", value))
		}
	}
	
	_, err = k.clientset.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
	if err != nil {
		k.logError("UpdateAPIKeySecret", err)
		return fmt.Errorf("failed to update API key secret: %w", err)
	}
	
	return nil
}

func (k *K8sClient) DeleteAPIKeySecret(namespace, secretName string) error {
	ctx := context.Background()
	
	err := k.clientset.CoreV1().Secrets(namespace).Delete(ctx, secretName, metav1.DeleteOptions{})
	if err != nil {
		k.logError("DeleteAPIKeySecret", err)
		return fmt.Errorf("failed to delete API key secret: %w", err)
	}
	
	return nil
}

func (k *K8sClient) ListAPIKeySecrets(namespace string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	labelSelector := "app=published-model,type=apikey"
	
	secrets, err := k.clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		k.logError("ListAPIKeySecrets", err)
		return nil, fmt.Errorf("failed to list API key secrets: %w", err)
	}
	
	var result []map[string]interface{}
	for _, secret := range secrets.Items {
		secretData := make(map[string]interface{})
		for key, value := range secret.Data {
			secretData[key] = string(value)
		}
		result = append(result, secretData)
	}
	
	return result, nil
}

// Gateway Configuration Management
func (k *K8sClient) CreateHTTPRoute(namespace string, httpRoute map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredRoute := &unstructured.Unstructured{
		Object: httpRoute,
	}
	
	_, err := k.dynamicClient.Resource(HTTPRouteGVR).Namespace(namespace).Create(ctx, unstructuredRoute, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateHTTPRoute", err)
		return fmt.Errorf("failed to create HTTPRoute: %w", err)
	}
	
	return nil
}

func (k *K8sClient) DeleteHTTPRoute(namespace, routeName string) error {
	ctx := context.Background()
	
	err := k.dynamicClient.Resource(HTTPRouteGVR).Namespace(namespace).Delete(ctx, routeName, metav1.DeleteOptions{})
	if err != nil {
		k.logError("DeleteHTTPRoute", err)
		return fmt.Errorf("failed to delete HTTPRoute: %w", err)
	}
	
	return nil
}

func (k *K8sClient) CreateAIGatewayRoute(namespace string, aiGatewayRoute map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredRoute := &unstructured.Unstructured{
		Object: aiGatewayRoute,
	}
	
	_, err := k.dynamicClient.Resource(AIGatewayRouteGVR).Namespace(namespace).Create(ctx, unstructuredRoute, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateAIGatewayRoute", err)
		return fmt.Errorf("failed to create AIGatewayRoute: %w", err)
	}
	
	return nil
}

func (k *K8sClient) DeleteAIGatewayRoute(namespace, routeName string) error {
	ctx := context.Background()
	
	err := k.dynamicClient.Resource(AIGatewayRouteGVR).Namespace(namespace).Delete(ctx, routeName, metav1.DeleteOptions{})
	if err != nil {
		k.logError("DeleteAIGatewayRoute", err)
		return fmt.Errorf("failed to delete AIGatewayRoute: %w", err)
	}
	
	return nil
}

func (k *K8sClient) CreateBackendTrafficPolicy(namespace string, policy map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredPolicy := &unstructured.Unstructured{
		Object: policy,
	}
	
	_, err := k.dynamicClient.Resource(BackendTrafficPolicyGVR).Namespace(namespace).Create(ctx, unstructuredPolicy, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateBackendTrafficPolicy", err)
		return fmt.Errorf("failed to create BackendTrafficPolicy: %w", err)
	}
	
	return nil
}

func (k *K8sClient) DeleteBackendTrafficPolicy(namespace, policyName string) error {
	ctx := context.Background()
	
	err := k.dynamicClient.Resource(BackendTrafficPolicyGVR).Namespace(namespace).Delete(ctx, policyName, metav1.DeleteOptions{})
	if err != nil {
		k.logError("DeleteBackendTrafficPolicy", err)
		return fmt.Errorf("failed to delete BackendTrafficPolicy: %w", err)
	}
	
	return nil
}

// ConfigMap Management for Audit Logs
func (k *K8sClient) CreateConfigMap(namespace, configMapName string, data map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert data to JSON string
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}
	
	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":  "published-model",
				"type": "audit-log",
			},
		},
		Data: map[string]string{
			"data.json": string(dataJSON),
		},
	}
	
	_, err = k.clientset.CoreV1().ConfigMaps(namespace).Create(ctx, configMap, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateConfigMap", err)
		return fmt.Errorf("failed to create ConfigMap: %w", err)
	}
	
	return nil
}

func (k *K8sClient) GetConfigMap(namespace, configMapName string) (map[string]interface{}, error) {
	ctx := context.Background()
	
	configMap, err := k.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetConfigMap", err)
		return nil, fmt.Errorf("failed to get ConfigMap: %w", err)
	}
	
	dataJSON, exists := configMap.Data["data.json"]
	if !exists {
		return nil, fmt.Errorf("data.json not found in ConfigMap")
	}
	
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal data: %w", err)
	}
	
	return data, nil
}

func (k *K8sClient) UpdateConfigMap(namespace, configMapName string, data map[string]interface{}) error {
	ctx := context.Background()
	
	// Get existing ConfigMap
	configMap, err := k.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		k.logError("GetConfigMap", err)
		return fmt.Errorf("failed to get ConfigMap: %w", err)
	}
	
	// Convert data to JSON string
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}
	
	// Update the data
	configMap.Data["data.json"] = string(dataJSON)
	
	_, err = k.clientset.CoreV1().ConfigMaps(namespace).Update(ctx, configMap, metav1.UpdateOptions{})
	if err != nil {
		k.logError("UpdateConfigMap", err)
		return fmt.Errorf("failed to update ConfigMap: %w", err)
	}
	
	return nil
}
// Missing Gateway API operations


// Helper function to check if error is resource not found
func IsResourceNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "not found")
}

func (k *K8sClient) CreateBackend(namespace string, backend map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredBackend := &unstructured.Unstructured{
		Object: backend,
	}
	
	_, err := k.dynamicClient.Resource(BackendGVR).Namespace(namespace).Create(ctx, unstructuredBackend, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateBackend", err)
		return fmt.Errorf("failed to create Backend: %w", err)
	}
	
	return nil
}

func (k *K8sClient) CreateAIServiceBackend(namespace string, aiServiceBackend map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredBackend := &unstructured.Unstructured{
		Object: aiServiceBackend,
	}
	
	_, err := k.dynamicClient.Resource(AIServiceBackendGVR).Namespace(namespace).Create(ctx, unstructuredBackend, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateAIServiceBackend", err)
		return fmt.Errorf("failed to create AIServiceBackend: %w", err)
	}
	
	return nil
}

func (k *K8sClient) CreateReferenceGrant(namespace string, referenceGrant map[string]interface{}) error {
	ctx := context.Background()
	
	// Convert to unstructured for dynamic client
	unstructuredGrant := &unstructured.Unstructured{
		Object: referenceGrant,
	}
	
	_, err := k.dynamicClient.Resource(ReferenceGrantGVR).Namespace(namespace).Create(ctx, unstructuredGrant, metav1.CreateOptions{})
	if err != nil {
		k.logError("CreateReferenceGrant", err)
		return fmt.Errorf("failed to create ReferenceGrant: %w", err)
	}
	
	return nil
}