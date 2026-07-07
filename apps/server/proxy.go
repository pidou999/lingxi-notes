package main

import (
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

// 不验证 SSL 的 HTTP 客户端
var insecureClient = &http.Client{
	Timeout: 60 * time.Second,
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	},
}

// proxyFetchModelsHandler — 获取模型列表
// POST /api/proxy/fetch-models  body: { baseUrl, apiKey, protocol }
func proxyFetchModelsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BaseURL  string `json:"baseUrl"`
		APIKey   string `json:"apiKey"`
		Protocol string `json:"protocol"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"请求格式错误"}`, 400)
		return
	}
	if body.BaseURL == "" || body.APIKey == "" {
		http.Error(w, `{"error":"缺少 baseUrl 或 apiKey"}`, 400)
		return
	}

	var models []string

	if body.Protocol == "Anthropic" {
		req, _ := http.NewRequest("GET", "https://api.anthropic.com/v1/models", nil)
		req.Header.Set("x-api-key", body.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")

		resp, err := insecureClient.Do(req)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 {
			writeJSON(w, 500, map[string]string{"error": "API " + resp.Status + ": " + string(raw)})
			return
		}

		var data struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		json.Unmarshal(raw, &data)
		for _, m := range data.Data {
			models = append(models, m.ID)
		}
	} else {
		url := strings.TrimRight(body.BaseURL, "/") + "/models"
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer "+body.APIKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := insecureClient.Do(req)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != 200 {
			writeJSON(w, 500, map[string]string{"error": "API " + resp.Status + ": " + string(raw)})
			return
		}

		var data struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		json.Unmarshal(raw, &data)
		for _, m := range data.Data {
			models = append(models, m.ID)
		}
	}

	writeJSON(w, 200, map[string]any{"models": models})
}

// proxyTestConnectionHandler — 连通测试
// POST /api/proxy/test-connection  body: { baseUrl, apiKey, model, protocol }
func proxyTestConnectionHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BaseURL  string `json:"baseUrl"`
		APIKey   string `json:"apiKey"`
		Model    string `json:"model"`
		Protocol string `json:"protocol"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "error": "请求格式错误"})
		return
	}
	if body.BaseURL == "" || body.APIKey == "" {
		writeJSON(w, 200, map[string]any{"ok": false, "error": "缺少 baseUrl 或 apiKey"})
		return
	}

	var resp *http.Response
	var err error

	if body.Protocol == "Anthropic" {
		payload := map[string]any{
			"model":      body.Model,
			"max_tokens": 1,
			"messages":   []any{map[string]string{"role": "user", "content": "Hi"}},
		}
		p, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", strings.NewReader(string(p)))
		req.Header.Set("x-api-key", body.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")
		resp, err = insecureClient.Do(req)
	} else {
		url := strings.TrimRight(body.BaseURL, "/") + "/chat/completions"
		payload := map[string]any{
			"model":      body.Model,
			"messages":   []any{map[string]string{"role": "user", "content": "Hi"}},
			"max_tokens": 1,
		}
		p, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", url, strings.NewReader(string(p)))
		req.Header.Set("Authorization", "Bearer "+body.APIKey)
		req.Header.Set("Content-Type", "application/json")
		resp, err = insecureClient.Do(req)
	}

	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		writeJSON(w, 200, map[string]any{"ok": true})
	} else {
		raw, _ := io.ReadAll(resp.Body)
		writeJSON(w, 200, map[string]any{"ok": false, "error": "API " + resp.Status + ": " + string(raw[:min(len(raw), 200)])})
	}
}

// proxyChatHandler — AI Chat 代理
// POST /api/proxy/chat  body: { provider: { baseUrl, apiKey, protocol }, model, messages }
func proxyChatHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider *struct {
			BaseURL  string `json:"baseUrl"`
			APIKey   string `json:"apiKey"`
			Protocol string `json:"protocol"`
		} `json:"provider"`
		Model    string `json:"model"`
		Messages []any  `json:"messages"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"请求格式错误"}`, 400)
		return
	}
	if body.Provider == nil || body.Provider.BaseURL == "" || body.Provider.APIKey == "" {
		http.Error(w, `{"error":"缺少 provider 配置"}`, 400)
		return
	}
	if body.Model == "" || len(body.Messages) == 0 {
		http.Error(w, `{"error":"缺少 model 或 messages"}`, 400)
		return
	}

	baseURL := body.Provider.BaseURL
	apiKey := body.Provider.APIKey
	protocol := body.Provider.Protocol

	var resp *http.Response
	var err error

	if protocol == "Anthropic" {
		payload := map[string]any{
			"model":      body.Model,
			"max_tokens": 4096,
			"messages":   body.Messages,
		}
		p, _ := json.Marshal(payload)

		req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", strings.NewReader(string(p)))
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("Content-Type", "application/json")
		resp, err = insecureClient.Do(req)
	} else {
		url := strings.TrimRight(baseURL, "/") + "/chat/completions"
		payload := map[string]any{
			"model":      body.Model,
			"messages":   body.Messages,
			"max_tokens": 4096,
		}
		p, _ := json.Marshal(payload)

		req, _ := http.NewRequest("POST", url, strings.NewReader(string(p)))
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		resp, err = insecureClient.Do(req)
	}

	if err != nil {
		http.Error(w, `{"error":"`+jsonEscape(err.Error())+`"}`, 500)
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		http.Error(w, `{"error":"API `+resp.Status+`: `+jsonEscape(string(raw[:min(len(raw), 300)]))+`"}`, 500)
		return
	}

	// 提取响应内容
	var content string
	if protocol == "Anthropic" {
		var data struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(raw, &data); err == nil {
			for _, c := range data.Content {
				content += c.Text
			}
		}
	} else {
		var data struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(raw, &data); err == nil && len(data.Choices) > 0 {
			content = data.Choices[0].Message.Content
		}
	}

	if content == "" {
		// 尝试从原始响应中提取 JSON
		start := strings.Index(string(raw), "{")
		end := strings.LastIndex(string(raw), "}")
		if start != -1 && end > start {
			var data2 struct {
				Choices []struct {
					Message struct {
						Content string `json:"content"`
					} `json:"message"`
				} `json:"choices"`
			}
			if err2 := json.Unmarshal(raw[start:end+1], &data2); err2 == nil && len(data2.Choices) > 0 {
				content = data2.Choices[0].Message.Content
			}
		}
	}

	writeJSON(w, 200, map[string]any{"content": content})
}

func jsonEscape(s string) string {
	b, _ := json.Marshal(s)
	// 去掉两端的引号，否则嵌套 JSON 时出问题
	if len(b) >= 2 {
		return string(b[1 : len(b)-1])
	}
	return s
}
