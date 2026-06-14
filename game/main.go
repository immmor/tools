package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"time"
)

// ==========================================
// 1. 基础配置与核心结构
// ==========================================

type PlayType string

const (
	Top2  PlayType = "Top2"
	Top3  PlayType = "Top3"
	Top4  PlayType = "Top4"
	Pick2 PlayType = "Pick2"
	Pick3 PlayType = "Pick3"
	Pick4 PlayType = "Pick4"
	Pick5 PlayType = "Pick5"
	Pick6 PlayType = "Pick6"
	Pick7 PlayType = "Pick7"
	Pick8 PlayType = "Pick8"
)

var PayoutOdds = map[PlayType]float64{
	Top2: 30.0, Top3: 110.0, Top4: 240.0,
	Pick2: 3.0, Pick3: 10.0, Pick4: 50.0, Pick5: 400.0,
	Pick6: 60.0, Pick7: 18.0, Pick8: 7.0,
}

var RequiredBallCount = map[PlayType]int{
	Top2: 2, Top3: 3, Top4: 4,
	Pick2: 2, Pick3: 3, Pick4: 4, Pick5: 5, Pick6: 6, Pick7: 7, Pick8: 8,
}

type GameState string

const (
	StateBetting GameState = "Betting" // 下注阶段 (4分30秒)
	StateDrawing GameState = "Drawing" // 开奖动画及结算阶段 (30秒)
)

// BetOrder 投注订单模型
type BetOrder struct {
	OrderID   string   `json:"order_id"`
	PlayMode  PlayType `json:"play_mode"`
	Selects   []int    `json:"selects"`
	Amount    float64  `json:"amount"`
	IsDeleted bool     `json:"is_deleted"`
}

// DrawResult 开奖结果
type DrawResult struct {
	IssueNo  string `json:"issue_no"`
	Top5Cars []int  `json:"top_5_cars"`
}

// LotteryRoom 全局游戏控制
type LotteryRoom struct {
	mu           sync.RWMutex
	IssueNo      int
	CurrentState GameState
	Orders       map[string]*BetOrder
	StateEndTime time.Time
	LastResult   *DrawResult // 记录上一期的开奖结果供前端查询
}

// GlobalRoom 实例化房间实例
var GlobalRoom = &LotteryRoom{
	IssueNo:      2026001,
	CurrentState: StateBetting,
	Orders:       make(map[string]*BetOrder),
}

// ==========================================
// 2. 核心算法：中奖校验结算
// ==========================================

func CheckWinning(order *BetOrder, result DrawResult) (bool, float64) {
	if order.IsDeleted || len(result.Top5Cars) < 5 {
		return false, 0
	}
	if len(order.Selects) != RequiredBallCount[order.PlayMode] {
		return false, 0
	}

	switch order.PlayMode {
	case Top2, Top3, Top4:
		var targetCount int
		switch order.PlayMode {
		case Top2:
			targetCount = 2
		case Top3:
			targetCount = 3
		case Top4:
			targetCount = 4
		}
		targetCars := result.Top5Cars[:targetCount]
		if matchAll(order.Selects, targetCars) {
			return true, order.Amount * PayoutOdds[order.PlayMode]
		}
	case Pick2, Pick3, Pick4, Pick5:
		if matchAll(order.Selects, result.Top5Cars) {
			return true, order.Amount * PayoutOdds[order.PlayMode]
		}
	case Pick6, Pick7, Pick8:
		if matchAll(result.Top5Cars, order.Selects) {
			return true, order.Amount * PayoutOdds[order.PlayMode]
		}
	}
	return false, 0
}

func matchAll(sliceA, sliceB []int) bool {
	mapB := make(map[int]bool)
	for _, v := range sliceB {
		mapB[v] = true
	}
	for _, v := range sliceA {
		if !mapB[v] {
			return false
		}
	}
	return true
}

// ==========================================
// 3. HTTP 统一响应工具
// ==========================================

type Response struct {
	Code int         `json:"code"` // 200 为成功，其他为失败
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, code int, msg string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Response{
		Code: code,
		Msg:  msg,
		Data: data,
	})
}

// ==========================================
// 4. HTTP 接口处理函数 (Handlers)
// ==========================================

// GetStatusHandler 获取当前期状态、倒计时和上一期开奖结果
func GetStatusHandler(w http.ResponseWriter, r *http.Request) {
	GlobalRoom.mu.RLock()
	defer GlobalRoom.mu.RUnlock()

	timeLeft := int(time.Until(GlobalRoom.StateEndTime).Seconds())
	if timeLeft < 0 {
		timeLeft = 0
	}

	data := map[string]interface{}{
		"issue_no":    fmt.Sprintf("No.%d", GlobalRoom.IssueNo),
		"state":       GlobalRoom.CurrentState,
		"time_left":   timeLeft, // 剩余秒数
		"last_result": GlobalRoom.LastResult,
	}
	writeJSON(w, http.StatusOK, 200, "success", data)
}

// PlaceBetReq 下注接口请求体
type PlaceBetReq struct {
	OrderID  string   `json:"order_id"`
	PlayMode PlayType `json:"play_mode"`
	Selects  []int    `json:"selects"`
	Amount   float64  `json:"amount"`
}

// PlaceBetHandler 玩家下注接口
func PlaceBetHandler(w http.ResponseWriter, r *http.Request) {
	var req PlaceBetReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, 400, "参数格式错误", nil)
		return
	}

	GlobalRoom.mu.Lock()
	defer GlobalRoom.mu.Unlock()

	// 1. 检查游戏状态
	if GlobalRoom.CurrentState != StateBetting {
		writeJSON(w, http.StatusForbidden, 403, "当前不在下注时间段内", nil)
		return
	}

	// 2. 验证选球数量
	required, exist := RequiredBallCount[req.PlayMode]
	if !exist || len(req.Selects) != required {
		writeJSON(w, http.StatusBadRequest, 400, fmt.Sprintf("选号数量不符合玩法 [%s] 的要求", req.PlayMode), nil)
		return
	}

	// 3. 保存订单 (实际开发应持久化到数据库/Redis)
	sort.Ints(req.Selects) // 统一升序排列
	GlobalRoom.Orders[req.OrderID] = &BetOrder{
		OrderID:   req.OrderID,
		PlayMode:  req.PlayMode,
		Selects:   req.Selects,
		Amount:    req.Amount,
		IsDeleted: false,
	}

	fmt.Printf("📥 [HTTP 下注] 订单: %s | 玩法: %s | 号码: %v | 金额: %.2f\n", req.OrderID, req.PlayMode, req.Selects, req.Amount)
	writeJSON(w, http.StatusOK, 200, "下注成功", nil)
}

// CancelBetReq 取消订单请求体
type CancelBetReq struct {
	OrderID string `json:"order_id"`
}

// CancelBetHandler 取消下注接口 (4分30秒内可退款)
func CancelBetHandler(w http.ResponseWriter, r *http.Request) {
	var req CancelBetReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, 400, "参数格式错误", nil)
		return
	}

	GlobalRoom.mu.Lock()
	defer GlobalRoom.mu.Unlock()

	// 关键风控：进入开奖动画阶段则强制锁死禁止撤单
	if GlobalRoom.CurrentState != StateBetting {
		writeJSON(w, http.StatusForbidden, 403, "已截止下注，无法取消订单", nil)
		return
	}

	order, exist := GlobalRoom.Orders[req.OrderID]
	if !exist || order.IsDeleted {
		writeJSON(w, http.StatusNotFound, 404, "订单不存在或已取消", nil)
		return
	}

	order.IsDeleted = true
	fmt.Printf("↩️ [HTTP 撤单] 订单 %s 已成功退款\n", req.OrderID)
	writeJSON(w, http.StatusOK, 200, "订单取消成功，金额已退回", nil)
}

// ==========================================
// 5. 核心状态机进程 & 模拟控制开奖
// ==========================================

func (r *LotteryRoom) ExecuteDraw() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 模拟后端控奖：随机生成1-12不重复的前5名赛车排名
	pool := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	finalTop5 := pool[:5]

	result := DrawResult{
		IssueNo:  fmt.Sprintf("No.%d", r.IssueNo),
		Top5Cars: finalTop5,
	}
	r.LastResult = &result // 缓存给前端查询

	fmt.Printf("\n🏁 ======= 期号 %s 开奖结果确定 =======\n", result.IssueNo)
	fmt.Printf("🏆 赛车最终排名 (1~5名): %v\n", result.Top5Cars)

	// 遍历本期订单派奖
	var totalBet, totalPayout float64
	for _, order := range r.Orders {
		if order.IsDeleted {
			continue
		}
		totalBet += order.Amount
		isWin, prize := CheckWinning(order, result)
		if isWin {
			totalPayout += prize
			fmt.Printf("🎉 [中奖] 订单: %s | 玩法: %s | 获赠奖金: ￥%.2f\n", order.OrderID, order.PlayMode, prize)
		}
	}
	fmt.Printf("📊 [本期小结] 总投注: ￥%.2f | 总派奖: ￥%.2f\n\n", totalBet, totalPayout)

	// 清理上一期订单，期号+1
	r.Orders = make(map[string]*BetOrder)
	r.IssueNo++
}

func (r *LotteryRoom) StartGameLoop(ctx context.Context) {
	// 演示时缩短时间线（下注45秒，开奖15秒），实际上线可改为：4*time.Minute + 30*time.Second
	betDuration := 45 * time.Second
	drawDuration := 15 * time.Second

	for {
		select {
		case <-ctx.Done():
			return
		default:
			// 1. 开启下注
			r.mu.Lock()
			r.CurrentState = StateBetting
			r.StateEndTime = time.Now().Add(betDuration)
			r.mu.Unlock()
			time.Sleep(betDuration)

			// 2. 截止下注，进行开奖
			r.mu.Lock()
			r.CurrentState = StateDrawing
			r.StateEndTime = time.Now().Add(drawDuration)
			r.mu.Unlock()

			r.ExecuteDraw()
			time.Sleep(drawDuration)
		}
	}
}

// ==========================================
// 6. 主函数：启动 HTTP 服务
// ==========================================

func main() {
	// 1. 异步启动 24 小时状态机循环
	go GlobalRoom.StartGameLoop(context.Background())

	// 2. 注册 HTTP 路由 (使用 Go 标准库自带的新型多路复用器)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/game/status", GetStatusHandler)  // 获取状态及上一期结果
	mux.HandleFunc("POST /api/game/bet", PlaceBetHandler)     // 玩家下注接口
	mux.HandleFunc("POST /api/game/cancel", CancelBetHandler) // 玩家取消接口

	// 3. 启动 HTTP 监听
	port := ":8080"
	fmt.Printf("🚀 12选5后端服务已启动，正在监听端口 %s ...\n", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		fmt.Printf("服务器启动失败: %v\n", err)
	}
}
