package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// GetIngresses retrieves ingresses
func (k *K8sClient) GetIngresses(namespace string) ([]networkingv1.Ingress, error) {
	ctx := context.Background()
	
	var ingresses *networkingv1.IngressList
	var err error
	
	if namespace == "" {
		ingresses, err = k.clientset.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
	} else {
		ingresses, err = k.clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to list ingresses: %w", err)
	}
	
	return ingresses.Items, nil
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