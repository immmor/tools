use reqwest;
use scraper::{Html, Selector};
use std::time::Instant;
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "http://127.0.0.1:5500/image.html";
    let num_requests = 10000;
    
    println!("开始向 {} 发送 {} 个请求，获取完整网页内容", url, num_requests);
    let start_time = Instant::now();
    
    // 创建向量来保存所有请求任务
    let mut tasks = Vec::new();
    
    for i in 0..num_requests {
        let task = tokio::spawn(async move {
            let client = reqwest::Client::new();
            match client.get(url).send().await {
                Ok(response) => {
                    let status = response.status();
                    
                    // 获取完整的HTML内容
                    match response.text().await {
                        Ok(html_content) => {
                            // 解析HTML
                            let document = Html::parse_document(&html_content);
                            
                            // 提取页面标题
                            let title_selector = Selector::parse("title").unwrap();
                            let title = document
                                .select(&title_selector)
                                .next()
                                .map(|e| e.text().collect::<String>())
                                .unwrap_or_else(|| "无标题".to_string());
                            
                            // 统计页面中的链接数量
                            let link_selector = Selector::parse("a").unwrap();
                            let link_count = document.select(&link_selector).count();
                            
                            // 统计页面中的图片数量
                            let img_selector = Selector::parse("img").unwrap();
                            let img_count = document.select(&img_selector).count();
                            
                            // 获取页面内容长度
                            let content_length = html_content.len();
                            
                            println!("请求 {}: 状态 {} | 标题: {} | 内容大小: {} 字节 | 链接: {} | 图片: {}", 
                                   i + 1, status, title.trim(), content_length, link_count, img_count);
                            
                            Ok((status, content_length, title, link_count, img_count))
                        }
                        Err(e) => {
                            eprintln!("请求 {} 获取内容失败: {}", i + 1, e);
                            Err(e)
                        }
                    }
                }
                Err(e) => {
                    eprintln!("请求 {} 失败: {}", i + 1, e);
                    Err(e)
                }
            }
        });
        tasks.push(task);
    }
    
    // 等待所有请求完成
    let mut successful_requests = 0;
    let mut failed_requests = 0;
    let mut total_content_size = 0;
    let mut total_links = 0;
    let mut total_images = 0;
    
    for task in tasks {
        match task.await {
            Ok(Ok((_status, content_size, _title, link_count, img_count))) => {
                successful_requests += 1;
                total_content_size += content_size;
                total_links += link_count;
                total_images += img_count;
            }
            Ok(Err(_)) => failed_requests += 1,
            Err(_) => failed_requests += 1,
        }
    }
    
    let duration = start_time.elapsed();
    
    println!("\n=== 请求汇总 ===");
    println!("总请求数: {}", num_requests);
    println!("成功请求: {}", successful_requests);
    println!("失败请求: {}", failed_requests);
    println!("总内容大小: {} 字节", total_content_size);
    println!("平均内容大小: {} 字节", total_content_size / successful_requests.max(1) as usize);
    println!("总链接数: {}", total_links);
    println!("总图片数: {}", total_images);
    println!("总耗时: {:.2?}", duration);
    println!("平均每个请求耗时: {:.2?}", duration / num_requests as u32);
    
    Ok(())
}
