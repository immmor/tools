package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

// ---- Request / Response shapes ----

type chatRequest struct {
	Mode    string `json:"mode"`    // "chat" | "search"
	Message string `json:"message"`
}

type citation struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

type chatResponse struct {
	Text      string     `json:"text"`
	Citations []citation `json:"citations"`
	IsSearch  bool       `json:"isSearch"`
	Error     string     `json:"error,omitempty"`
}

// ---- Helpers ----

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// loadDotEnv reads a simple .env file (KEY=VALUE, # comments) into the process
// environment. Existing real env vars take precedence over values in the file.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return // no .env is fine; rely on real environment
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		val = strings.Trim(val, `"'`)
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// decodeDDG extracts the real URL from DuckDuckGo's /l/?uddg=... redirect links.
func decodeDDG(href string) string {
	if i := strings.Index(href, "uddg="); i >= 0 {
		rest := href[i+5:]
		if amp := strings.Index(rest, "&"); amp >= 0 {
			rest = rest[:amp]
		}
		if dec, err := url.QueryUnescape(rest); err == nil {
			return dec
		}
	}
	return href
}

var tagRe = regexp.MustCompile(`<[^>]+>`)

func stripTags(s string) string {
	s = tagRe.ReplaceAllString(s, "")
	repl := map[string]string{
		"&amp;":  "&",
		"&quot;": "\"",
		"&#39;":  "'",
		"&lt;":   "<",
		"&gt;":   ">",
		"&nbsp;": " ",
	}
	for from, to := range repl {
		s = strings.ReplaceAll(s, from, to)
	}
	return strings.TrimSpace(s)
}

type searchRow struct {
	title string
	href  string
	snip string
}

func snipAt(matches [][]string, i int) string {
	if i < len(matches) {
		return stripTags(matches[i][1])
	}
	return ""
}

// renderCitations turns scraped rows into citations + an LLM context blob.
func renderCitations(rows []searchRow) ([]citation, string) {
	var citations []citation
	var ctx strings.Builder
	for _, r := range rows {
		if r.title == "" {
			continue
		}
		citations = append(citations, citation{Title: r.title, URL: r.href})
		fmt.Fprintf(&ctx, "\n[来源 %d] %s\n%s\n%s\n", len(citations), r.title, r.href, r.snip)
	}
	return citations, ctx.String()
}

// webSearch tries multiple no-key sources and returns the first that yields results.
// The user's query is passed verbatim — no rewriting. Bing News vertical is tried
// first (it understands temporal intent like "最近/最新" as recency), then Bing Web,
// then DuckDuckGo as last resort.
func webSearch(query string) ([]citation, string) {
	log.Printf("[search] query=%q", query)

	if c, ctx := bingNewsSearch(query); len(c) > 0 {
		log.Printf("[search] bing-news OK, results=%d", len(c))
		return c, ctx
	}
	log.Printf("[search] bing-news 0 results, falling back to bing-web")

	if c, ctx := bingWebSearch(query); len(c) > 0 {
		log.Printf("[search] bing-web OK, results=%d", len(c))
		return c, ctx
	}
	log.Printf("[search] bing-web 0 results, falling back to ddg")

	if c, ctx := ddgSearch(query); len(c) > 0 {
		log.Printf("[search] ddg OK, results=%d", len(c))
		return c, ctx
	}
	log.Printf("[search] ddg 0 results, giving up")
	return nil, ""
}

// bingWebSearch scrapes the Bing Web results (literal query, no rewriting).
// Used as a fallback when the News vertical yields nothing.
func bingWebSearch(query string) ([]citation, string) {
	endpoint := "https://cn.bing.com/search?q=" + url.QueryEscape(query) + "&setlang=zh-CN&count=10"
	log.Printf("[bing-web] GET %s", endpoint)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		log.Printf("[bing-web] request build error: %v", err)
		return nil, ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[bing-web] request error: %v", err)
		return nil, ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	htmlStr := string(body)
	log.Printf("[bing-web] status=%s bodyLen=%d", resp.Status, len(htmlStr))

	// Global parsing: titles come from <h2><a href="https://...">, snippets from
	// any Bing result paragraph (b_lineclamp / b_paractl / b_caption p, etc.).
	// Bing renders each result as h2 followed by its caption <p>, so index pairing holds.
	linkRe := regexp.MustCompile(`(?s)<h2>\s*<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>`)
	snipRe := regexp.MustCompile(`(?s)<p[^>]*class="b_[^"]*"[^>]*>(.*?)</p>`)

	tm := linkRe.FindAllStringSubmatch(htmlStr, -1)
	sm := snipRe.FindAllStringSubmatch(htmlStr, -1)
	log.Printf("[bing-web] titleMatches=%d snippetMatches=%d", len(tm), len(sm))

	var rows []searchRow
	n := len(tm)
	if n > 5 {
		n = 5
	}
	for i := 0; i < n; i++ {
		snippet := ""
		if i < len(sm) {
			snippet = stripTags(sm[i][1])
		}
		rows = append(rows, searchRow{href: tm[i][1], title: stripTags(tm[i][2]), snip: snippet})
	}
	logParsed("[bing-web]", rows)
	return renderCitations(rows)
}

// bingNewsSearch hits Bing's News vertical. For queries like "最近有什么科技新闻"
// it returns actual recent articles (it treats temporal words as recency, not as the
// song "最近"), so we search the user's query verbatim.
func bingNewsSearch(query string) ([]citation, string) {
	endpoint := "https://cn.bing.com/news/search?q=" + url.QueryEscape(query) + "&setlang=zh-CN&form=NPNEH"
	log.Printf("[bing-news] GET %s", endpoint)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		log.Printf("[bing-news] request build error: %v", err)
		return nil, ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[bing-news] request error: %v", err)
		return nil, ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	htmlStr := string(body)
	log.Printf("[bing-news] status=%s bodyLen=%d", resp.Status, len(htmlStr))

	// News cards: headline link has class containing "title"; summary in a
	// class containing "snippet"/"desc"/"summary". Index pairing holds because
	// each card lists its title before its summary.
	titleRe := regexp.MustCompile(`(?s)<a[^>]*class="[^"]*\btitle\b[^"]*"[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>`)
	snipRe := regexp.MustCompile(`(?s)<(?:div|p)[^>]*class="[^"]*(?:snippet|desc|summary)[^"]*"[^>]*>(.*?)</(?:div|p)>`)

	tm := titleRe.FindAllStringSubmatch(htmlStr, -1)
	sm := snipRe.FindAllStringSubmatch(htmlStr, -1)
	log.Printf("[bing-news] titleMatches=%d snippetMatches=%d", len(tm), len(sm))

	var rows []searchRow
	n := len(tm)
	if n > 5 {
		n = 5
	}
	for i := 0; i < n; i++ {
		snippet := ""
		if i < len(sm) {
			snippet = stripTags(sm[i][1])
		}
		rows = append(rows, searchRow{href: tm[i][1], title: stripTags(tm[i][2]), snip: snippet})
	}
	logParsed("[bing-news]", rows)
	return renderCitations(rows)
}

// ddgSearch scrapes DuckDuckGo HTML (POST) as a fallback source.
func ddgSearch(query string) ([]citation, string) {
	form := url.Values{}
	form.Set("q", query)
	req, err := http.NewRequest(http.MethodPost, "https://html.duckduckgo.com/html/", strings.NewReader(form.Encode()))
	if err != nil {
		log.Printf("[ddg] request build error: %v", err)
		return nil, ""
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	log.Printf("[ddg] POST https://html.duckduckgo.com/html/ q=%q", query)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ddg] request error: %v", err)
		return nil, ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	htmlStr := string(body)
	log.Printf("[ddg] status=%s bodyLen=%d", resp.Status, len(htmlStr))

	titleRe := regexp.MustCompile(`(?s)class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>`)
	snipRe := regexp.MustCompile(`(?s)class="result__snippet"[^>]*>(.*?)</a>`)

	tm := titleRe.FindAllStringSubmatch(htmlStr, -1)
	sm := snipRe.FindAllStringSubmatch(htmlStr, -1)
	log.Printf("[ddg] titleMatches=%d snippetMatches=%d", len(tm), len(sm))

	var rows []searchRow
	n := len(tm)
	if n > 5 {
		n = 5
	}
	for i := 0; i < n; i++ {
		rows = append(rows, searchRow{
			href:  decodeDDG(tm[i][1]),
			title: stripTags(tm[i][2]),
			snip:  snipAt(sm, i),
		})
	}
	logParsed("[ddg]", rows)
	return renderCitations(rows)
}

// logParsed logs the titles we extracted, for debugging search quality.
func logParsed(prefix string, rows []searchRow) {
	if len(rows) == 0 {
		log.Printf("%s parsed 0 rows", prefix)
		return
	}
	titles := make([]string, len(rows))
	for i, r := range rows {
		titles[i] = r.title
	}
	log.Printf("%s parsed %d rows: %v", prefix, len(rows), titles)
}

// callLLM talks to any OpenAI-compatible chat completions endpoint.
func callLLM(systemPrompt, userPrompt string) (string, error) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("缺少 LLM_API_KEY 环境变量")
	}
	base := strings.TrimRight(getEnv("LLM_BASE_URL", "https://api.openai.com/v1"), "/")
	model := getEnv("LLM_MODEL", "gpt-4o-mini")

	payload := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.7,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[llm] request error: %v", err)
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	log.Printf("[llm] status=%s replyLen=%d", resp.Status, len(respBody))
	if resp.StatusCode != http.StatusOK {
		log.Printf("[llm] error body: %s", truncate(string(respBody), 400))
		return "", fmt.Errorf("LLM 返回 %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &out); err != nil {
		return "", fmt.Errorf("解析 LLM 响应失败: %w", err)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("LLM 未返回内容")
	}
	return out.Choices[0].Message.Content, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// ---- Handlers ----

func chatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, chatResponse{Error: "请求格式错误"})
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		writeJSON(w, chatResponse{Error: "消息为空"})
		return
	}

	if req.Mode == "search" {
		citations, ctx := webSearch(req.Message)
		system := "你是 FUNLE 智能检索助手。如果用户提供了搜索结果（标注了来源编号 [1]、[2]...），请基于这些结果用中文、条理清晰地回答用户问题，" +
			"并在正文中用对应编号引用来源；只依据给定结果作答，不要编造结果之外的信息。" +
			"如果本次没有可用的搜索结果，请基于你自身的通用知识回答该问题，并在开头明确说明“以下基于模型已有知识，未经过实时联网核实”。"
		var user string
		if len(citations) == 0 {
			user = fmt.Sprintf("用户问题：%s\n\n（本次联网检索未返回结果，请直接基于你的通用知识回答，并在开头注明“以下基于模型已有知识，未经过实时联网核实”。）", req.Message)
		} else {
			user = fmt.Sprintf("用户问题：%s\n\n搜索结果：%s", req.Message, ctx)
		}
		text, err := callLLM(system, user)
		if err != nil {
			writeJSON(w, chatResponse{Error: err.Error()})
			return
		}
		writeJSON(w, chatResponse{Text: text, Citations: citations, IsSearch: true})
		return
	}

	system := "你是 FUNLE AI 智能助手，请用中文简洁、友好地回答用户的问题。"
	text, err := callLLM(system, req.Message)
	if err != nil {
		writeJSON(w, chatResponse{Error: err.Error()})
		return
	}
	writeJSON(w, chatResponse{Text: text, IsSearch: false})
}

func main() {
	loadDotEnv(".env")
	port := getEnv("PORT", "8080")
	http.HandleFunc("/api/chat", chatHandler)
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	log.Printf("FUNLE backend listening on :%s  (LLM_BASE_URL=%s MODEL=%s)",
		port, getEnv("LLM_BASE_URL", "https://api.openai.com/v1"), getEnv("LLM_MODEL", "gpt-4o-mini"))
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
