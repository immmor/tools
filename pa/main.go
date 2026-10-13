package main

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// 1. 文档结构定义
type Document struct {
	ID      int
	URL     string
	Title   string
	Content string
}

// 2. 搜索引擎核心结构
type SearchEngine struct {
	mutex    sync.RWMutex
	docs     map[int]Document
	index    map[string][]int
	docCount int
}

func NewSearchEngine() *SearchEngine {
	return &SearchEngine{
		docs:  make(map[int]Document),
		index: make(map[string][]int),
	}
}

// 分词函数
func tokenize(text string) []string {
	re := regexp.MustCompile(`[a-zA-Z0-9\p{Han}]+`)
	rawTokens := re.FindAllString(text, -1)

	var tokens []string
	for _, token := range rawTokens {
		token = strings.ToLower(token)
		if len(token) > 1 {
			tokens = append(tokens, token)
		}
	}
	return tokens
}

// 添加文档并建立倒排索引
func (se *SearchEngine) AddDocument(targetURL, title, content string) {
	se.mutex.Lock()
	defer se.mutex.Unlock()

	se.docCount++
	id := se.docCount
	doc := Document{ID: id, URL: targetURL, Title: title, Content: content}
	se.docs[id] = doc

	text := title + " " + content
	tokens := tokenize(text)

	seen := make(map[string]bool)
	for _, token := range tokens {
		if !seen[token] {
			seen[token] = true
			se.index[token] = append(se.index[token], id)
		}
	}
}

// 搜索功能
func (se *SearchEngine) Search(query string) []Document {
	se.mutex.RLock()
	defer se.mutex.RUnlock()

	queryTokens := tokenize(query)
	if len(queryTokens) == 0 {
		return nil
	}

	scores := make(map[int]int)
	for _, token := range queryTokens {
		if docIDs, exists := se.index[token]; exists {
			for _, id := range docIDs {
				scores[id]++
			}
		}
	}

	type Result struct {
		DocID int
		Score int
	}
	var results []Result
	for id, score := range scores {
		results = append(results, Result{DocID: id, Score: score})
	}

	// 降序排序
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[i].Score < results[j].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	var matchedDocs []Document
	for _, res := range results {
		matchedDocs = append(matchedDocs, se.docs[res.DocID])
	}
	return matchedDocs
}

// ==================== 真实爬虫模块 ====================

type Crawler struct {
	engine       *SearchEngine
	visited      map[string]bool
	visitedLock  sync.Mutex
	maxPages     int
	currentCount int
	proxyURL     string // 代理地址
}

func NewCrawler(engine *SearchEngine, maxPages int, proxyURL string) *Crawler {
	return &Crawler{
		engine:   engine,
		visited:  make(map[string]bool),
		maxPages: maxPages,
		proxyURL: proxyURL,
	}
}

func (c *Crawler) markVisited(targetURL string) bool {
	c.visitedLock.Lock()
	defer c.visitedLock.Unlock()
	if c.visited[targetURL] || c.currentCount >= c.maxPages {
		return false
	}
	c.visited[targetURL] = true
	c.currentCount++
	return true
}

func (c *Crawler) Crawl(startURL string) {
	var wg sync.WaitGroup
	queue := make(chan string, 1000)

	queue <- startURL
	c.markVisited(startURL)

	for i := 0; i < 3; i++ { // 降低并发数到 3，配合代理更稳定
		wg.Add(1)
		go func() {
			defer wg.Done()
			for currentURL := range queue {
				c.fetchAndParse(currentURL, queue)
				time.Sleep(1 * time.Second) // 增加抓取间隔
			}
		}()
	}

	time.Sleep(15 * time.Second) // 留出充足时间等待代理请求
	close(queue)
}

func (c *Crawler) fetchAndParse(targetURL string, queue chan<- string) {
	fmt.Printf("[爬虫正在抓取]: %s\n", targetURL)

	// 配置 HTTP 客户端与代理
	client := &http.Client{Timeout: 10 * time.Second}
	if c.proxyURL != "" {
		proxy, err := url.Parse(c.proxyURL)
		if err == nil {
			client.Transport = &http.Transport{
				Proxy: http.ProxyURL(proxy),
			}
		}
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[抓取失败] %s: %v\n", targetURL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("[抓取状态码异常] %s: %d\n", targetURL, resp.StatusCode)
		return
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return
	}

	title := strings.TrimSpace(doc.Find("title").Text())
	doc.Find("script, style, nav, footer").Remove()
	content := strings.TrimSpace(doc.Find("body").Text())
	content = regexp.MustCompile(`\s+`).ReplaceAllString(content, " ")

	if title != "" && len(content) > 50 {
		c.engine.AddDocument(targetURL, title, content)
		fmt.Printf("[索引成功] 标题: %s\n", title)
	}

	doc.Find("a[href]").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if !exists {
			return
		}

		parsedURL, err := url.Parse(href)
		if err != nil {
			return
		}

		base, err := url.Parse(targetURL)
		if err != nil {
			return
		}

		absoluteURL := base.ResolveReference(parsedURL).String()

		if strings.HasPrefix(absoluteURL, "http") {
			if c.markVisited(absoluteURL) {
				select {
				case queue <- absoluteURL:
				default:
				}
			}
		}
	})
}

func main() {
	se := NewSearchEngine()
	
	// 【注意】这里填入你的本地代理地址：
	// 如果是 Clash，通常是 "http://127.0.0.1:7890"
	// 如果不需要代理，可以传空字符串 `""`
	proxyURL := "http://127.0.0.1:7897" 

	crawler := NewCrawler(se, 10, proxyURL)

	seedURL := "https://go.dev/"
	fmt.Printf("开始启动真实爬虫（走代理: %s），种子页面: %s\n", proxyURL, seedURL)

	go crawler.Crawl(seedURL)

	fmt.Println("等待爬虫工作，10秒后开始执行搜索测试...")
	time.Sleep(11 * time.Second)

	query := "programming"
	fmt.Printf("\n----------------------------------------\n")
	fmt.Printf("用户正在搜索刚才爬到的内容: [%s]\n", query)
	fmt.Printf("----------------------------------------\n\n")

	results := se.Search(query)

	fmt.Printf("找到 %d 条相关结果：\n", len(results))
	for i, doc := range results {
		fmt.Printf("%d. 标题: %s\n   链接: %s\n   摘要片段: %.100s...\n\n", i+1, doc.Title, doc.URL, doc.Content)
	}
}