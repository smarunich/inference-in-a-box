package main

import (
	"fmt"
	"strings"
)

// DocumentationGenerator handles automatic API documentation generation
type DocumentationGenerator struct {
	config *Config
}

// NewDocumentationGenerator creates a new documentation generator
func NewDocumentationGenerator(config *Config) *DocumentationGenerator {
	return &DocumentationGenerator{
		config: config,
	}
}

// GenerateAPIDocumentation generates comprehensive API documentation for a published model
func (d *DocumentationGenerator) GenerateAPIDocumentation(namespace, modelName, modelType, externalURL, apiKey string) APIDocumentation {
	doc := APIDocumentation{
		EndpointURL: externalURL,
		AuthHeaders: map[string]string{
			"X-API-Key": apiKey,
		},
		ExampleRequests: d.generateExampleRequests(modelName, modelType, externalURL, apiKey),
		SDKExamples:     d.generateSDKExamples(modelName, modelType, externalURL, apiKey),
	}
	
	return doc
}

// generateExampleRequests generates example API requests
func (d *DocumentationGenerator) generateExampleRequests(modelName, modelType, externalURL, apiKey string) []ExampleRequest {
	var examples []ExampleRequest
	
	if modelType == "openai" {
		// OpenAI-compatible examples
		examples = append(examples, ExampleRequest{
			Method:      "POST",
			URL:         externalURL + "/chat/completions",
			Headers:     map[string]string{"X-API-Key": apiKey, "Content-Type": "application/json"},
			Body:        d.generateOpenAIChatExample(),
			Description: "Chat completion request (OpenAI compatible)",
		})
		
		examples = append(examples, ExampleRequest{
			Method:      "POST",
			URL:         externalURL + "/embeddings",
			Headers:     map[string]string{"X-API-Key": apiKey, "Content-Type": "application/json"},
			Body:        d.generateOpenAIEmbeddingExample(),
			Description: "Text embedding request (OpenAI compatible)",
		})
		
		examples = append(examples, ExampleRequest{
			Method:      "GET",
			URL:         externalURL + "/models",
			Headers:     map[string]string{"X-API-Key": apiKey},
			Body:        "",
			Description: "List available models (OpenAI compatible)",
		})
	} else {
		// Traditional inference examples
		examples = append(examples, ExampleRequest{
			Method:      "POST",
			URL:         externalURL + "/predict",
			Headers:     map[string]string{"X-API-Key": apiKey, "Content-Type": "application/json"},
			Body:        d.generateTraditionalPredictExample(modelName),
			Description: "Model prediction request",
		})
		
		examples = append(examples, ExampleRequest{
			Method:      "POST",
			URL:         fmt.Sprintf("%s/v1/models/%s:predict", externalURL, modelName),
			Headers:     map[string]string{"X-API-Key": apiKey, "Content-Type": "application/json"},
			Body:        d.generateKServeExample(),
			Description: "KServe v1 prediction request",
		})
		
		examples = append(examples, ExampleRequest{
			Method:      "GET",
			URL:         fmt.Sprintf("%s/v1/models/%s", externalURL, modelName),
			Headers:     map[string]string{"X-API-Key": apiKey},
			Body:        "",
			Description: "Get model metadata",
		})
	}
	
	return examples
}

// generateSDKExamples generates SDK examples for different programming languages
func (d *DocumentationGenerator) generateSDKExamples(modelName, modelType, externalURL, apiKey string) map[string]string {
	examples := make(map[string]string)
	
	if modelType == "openai" {
		examples["curl"] = d.generateOpenAICurlExample(externalURL, apiKey)
		examples["python"] = d.generateOpenAIPythonExample(externalURL, apiKey)
		examples["javascript"] = d.generateOpenAIJavaScriptExample(externalURL, apiKey)
		examples["go"] = d.generateOpenAIGoExample(externalURL, apiKey)
	} else {
		examples["curl"] = d.generateTraditionalCurlExample(modelName, externalURL, apiKey)
		examples["python"] = d.generateTraditionalPythonExample(modelName, externalURL, apiKey)
		examples["javascript"] = d.generateTraditionalJavaScriptExample(modelName, externalURL, apiKey)
		examples["go"] = d.generateTraditionalGoExample(modelName, externalURL, apiKey)
	}
	
	return examples
}

// OpenAI-compatible examples

func (d *DocumentationGenerator) generateOpenAIChatExample() string {
	return `{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
}`
}

func (d *DocumentationGenerator) generateOpenAIEmbeddingExample() string {
	return `{
  "model": "text-embedding-ada-002",
  "input": "The quick brown fox jumps over the lazy dog"
}`
}

func (d *DocumentationGenerator) generateOpenAICurlExample(externalURL, apiKey string) string {
	return fmt.Sprintf(`# Chat Completion
curl -X POST "%s/chat/completions" \
  -H "X-API-Key: %s" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'

# Text Embedding
curl -X POST "%s/embeddings" \
  -H "X-API-Key: %s" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-ada-002",
    "input": "The quick brown fox jumps over the lazy dog"
  }'`, externalURL, apiKey, externalURL, apiKey)
}

func (d *DocumentationGenerator) generateOpenAIPythonExample(externalURL, apiKey string) string {
	return fmt.Sprintf(`import openai
import requests

# Using OpenAI Python client (with custom base URL)
client = openai.OpenAI(
    api_key="%s",
    base_url="%s"
)

# Chat completion
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
    max_tokens=100,
    temperature=0.7
)

print(response.choices[0].message.content)

# Text embedding
embedding_response = client.embeddings.create(
    model="text-embedding-ada-002",
    input="The quick brown fox jumps over the lazy dog"
)

print(embedding_response.data[0].embedding)

# Using requests library directly
headers = {
    "X-API-Key": "%s",
    "Content-Type": "application/json"
}

data = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7
}

response = requests.post(
    "%s/chat/completions",
    headers=headers,
    json=data
)

print(response.json())`, apiKey, externalURL, apiKey, externalURL)
}

func (d *DocumentationGenerator) generateOpenAIJavaScriptExample(externalURL, apiKey string) string {
	return fmt.Sprintf(`// Using OpenAI JavaScript client
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '%s',
  baseURL: '%s'
});

// Chat completion
async function chatCompletion() {
  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    max_tokens: 100,
    temperature: 0.7
  });
  
  console.log(response.choices[0].message.content);
}

// Text embedding
async function textEmbedding() {
  const response = await client.embeddings.create({
    model: 'text-embedding-ada-002',
    input: 'The quick brown fox jumps over the lazy dog'
  });
  
  console.log(response.data[0].embedding);
}

// Using fetch API directly
async function fetchExample() {
  const response = await fetch('%s/chat/completions', {
    method: 'POST',
    headers: {
      'X-API-Key': '%s',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 100,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  console.log(data);
}

chatCompletion();
textEmbedding();
fetchExample();`, apiKey, externalURL, externalURL, apiKey)
}

func (d *DocumentationGenerator) generateOpenAIGoExample(externalURL, apiKey string) string {
	return fmt.Sprintf(`package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type ChatCompletionRequest struct {
	Model       string    ` + "`json:\"model\"`" + `
	Messages    []Message ` + "`json:\"messages\"`" + `
	MaxTokens   int       ` + "`json:\"max_tokens\"`" + `
	Temperature float64   ` + "`json:\"temperature\"`" + `
}

type Message struct {
	Role    string ` + "`json:\"role\"`" + `
	Content string ` + "`json:\"content\"`" + `
}

type ChatCompletionResponse struct {
	Choices []Choice ` + "`json:\"choices\"`" + `
}

type Choice struct {
	Message Message ` + "`json:\"message\"`" + `
}

func main() {
	apiKey := "%s"
	baseURL := "%s"
	
	// Chat completion request
	reqData := ChatCompletionRequest{
		Model: "gpt-3.5-turbo",
		Messages: []Message{
			{Role: "user", Content: "Hello, how are you?"},
		},
		MaxTokens:   100,
		Temperature: 0.7,
	}
	
	jsonData, err := json.Marshal(reqData)
	if err != nil {
		panic(err)
	}
	
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		panic(err)
	}
	
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	
	var response ChatCompletionResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		panic(err)
	}
	
	fmt.Println(response.Choices[0].Message.Content)
}`, apiKey, externalURL)
}

// Traditional inference examples

func (d *DocumentationGenerator) generateTraditionalPredictExample(modelName string) string {
	return `{
  "instances": [
    {
      "data": [1.0, 2.0, 3.0, 4.0]
    }
  ]
}`
}

func (d *DocumentationGenerator) generateKServeExample() string {
	return `{
  "instances": [
    [1.0, 2.0, 3.0, 4.0]
  ]
}`
}

func (d *DocumentationGenerator) generateTraditionalCurlExample(modelName, externalURL, apiKey string) string {
	return fmt.Sprintf(`# Standard prediction endpoint
curl -X POST "%s/predict" \
  -H "X-API-Key: %s" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [
      {
        "data": [1.0, 2.0, 3.0, 4.0]
      }
    ]
  }'

# KServe v1 endpoint
curl -X POST "%s/v1/models/%s:predict" \
  -H "X-API-Key: %s" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [
      [1.0, 2.0, 3.0, 4.0]
    ]
  }'

# Get model metadata
curl -X GET "%s/v1/models/%s" \
  -H "X-API-Key: %s"`, externalURL, apiKey, externalURL, modelName, apiKey, externalURL, modelName, apiKey)
}

func (d *DocumentationGenerator) generateTraditionalPythonExample(modelName, externalURL, apiKey string) string {
	return fmt.Sprintf(`import requests
import json

# API configuration
api_key = "%s"
base_url = "%s"
model_name = "%s"

headers = {
    "X-API-Key": api_key,
    "Content-Type": "application/json"
}

# Standard prediction
def predict_standard(data):
    payload = {
        "instances": [
            {"data": data}
        ]
    }
    
    response = requests.post(
        f"{base_url}/predict",
        headers=headers,
        json=payload
    )
    
    return response.json()

# KServe v1 prediction
def predict_kserve(data):
    payload = {
        "instances": [data]
    }
    
    response = requests.post(
        f"{base_url}/v1/models/{model_name}:predict",
        headers=headers,
        json=payload
    )
    
    return response.json()

# Get model metadata
def get_model_info():
    response = requests.get(
        f"{base_url}/v1/models/{model_name}",
        headers=headers
    )
    
    return response.json()

# Example usage
if __name__ == "__main__":
    # Sample input data
    input_data = [1.0, 2.0, 3.0, 4.0]
    
    # Make predictions
    result1 = predict_standard(input_data)
    print("Standard prediction:", result1)
    
    result2 = predict_kserve(input_data)
    print("KServe prediction:", result2)
    
    # Get model info
    model_info = get_model_info()
    print("Model info:", model_info)`, apiKey, externalURL, modelName)
}

func (d *DocumentationGenerator) generateTraditionalJavaScriptExample(modelName, externalURL, apiKey string) string {
	return fmt.Sprintf(`// API configuration
const apiKey = '%s';
const baseUrl = '%s';
const modelName = '%s';

const headers = {
  'X-API-Key': apiKey,
  'Content-Type': 'application/json'
};

// Standard prediction
async function predictStandard(data) {
  const payload = {
    instances: [
      { data: data }
    ]
  };
  
  const response = await fetch(` + "`${baseUrl}/predict`" + `, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

// KServe v1 prediction
async function predictKServe(data) {
  const payload = {
    instances: [data]
  };
  
  const response = await fetch(` + "`${baseUrl}/v1/models/${modelName}:predict`" + `, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

// Get model metadata
async function getModelInfo() {
  const response = await fetch(` + "`${baseUrl}/v1/models/${modelName}`" + `, {
    method: 'GET',
    headers: headers
  });
  
  return await response.json();
}

// Example usage
async function main() {
  // Sample input data
  const inputData = [1.0, 2.0, 3.0, 4.0];
  
  try {
    // Make predictions
    const result1 = await predictStandard(inputData);
    console.log('Standard prediction:', result1);
    
    const result2 = await predictKServe(inputData);
    console.log('KServe prediction:', result2);
    
    // Get model info
    const modelInfo = await getModelInfo();
    console.log('Model info:', modelInfo);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();`, apiKey, externalURL, modelName)
}

func (d *DocumentationGenerator) generateTraditionalGoExample(modelName, externalURL, apiKey string) string {
	return fmt.Sprintf(`package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type PredictionRequest struct {
	Instances []interface{} ` + "`json:\"instances\"`" + `
}

type StandardInstance struct {
	Data []float64 ` + "`json:\"data\"`" + `
}

type PredictionResponse struct {
	Predictions []interface{} ` + "`json:\"predictions\"`" + `
}

const (
	apiKey    = "%s"
	baseURL   = "%s"
	modelName = "%s"
)

func makeRequest(method, url string, payload interface{}) (*http.Response, error) {
	var reqBody io.Reader
	
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("X-API-Key", apiKey)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	client := &http.Client{}
	return client.Do(req)
}

func predictStandard(data []float64) (*PredictionResponse, error) {
	payload := PredictionRequest{
		Instances: []interface{}{
			StandardInstance{Data: data},
		},
	}
	
	resp, err := makeRequest("POST", baseURL+"/predict", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var result PredictionResponse
	err = json.Unmarshal(body, &result)
	return &result, err
}

func predictKServe(data []float64) (*PredictionResponse, error) {
	payload := PredictionRequest{
		Instances: []interface{}{data},
	}
	
	url := fmt.Sprintf("%%s/v1/models/%%s:predict", baseURL, modelName)
	resp, err := makeRequest("POST", url, payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var result PredictionResponse
	err = json.Unmarshal(body, &result)
	return &result, err
}

func getModelInfo() (map[string]interface{}, error) {
	url := fmt.Sprintf("%%s/v1/models/%%s", baseURL, modelName)
	resp, err := makeRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	return result, err
}

func main() {
	// Sample input data
	inputData := []float64{1.0, 2.0, 3.0, 4.0}
	
	// Make predictions
	result1, err := predictStandard(inputData)
	if err != nil {
		fmt.Printf("Standard prediction error: %%v\n", err)
	} else {
		fmt.Printf("Standard prediction: %%+v\n", result1)
	}
	
	result2, err := predictKServe(inputData)
	if err != nil {
		fmt.Printf("KServe prediction error: %%v\n", err)
	} else {
		fmt.Printf("KServe prediction: %%+v\n", result2)
	}
	
	// Get model info
	modelInfo, err := getModelInfo()
	if err != nil {
		fmt.Printf("Model info error: %%v\n", err)
	} else {
		fmt.Printf("Model info: %%+v\n", modelInfo)
	}
}`, apiKey, externalURL, modelName)
}