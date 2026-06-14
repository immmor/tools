import os
import json
import re
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def parse_detail(filepath):
    """解析单个详情页HTML，提取关键信息"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            html = f.read()
    except Exception:
        return None

    soup = BeautifulSoup(html, 'html.parser')

    # 标题
    h1 = soup.find('h1')
    title = h1.get_text(strip=True) if h1 else ''

    if not title:
        return None  # 无标题说明是空页或拦截页

    # 分类（面包屑）
    crumb = soup.find('div', class_='crumb')
    category = ''
    sub_category = ''
    if crumb:
        links = crumb.find_all('a')
        cats = [a.get_text(strip=True) for a in links]
        if len(cats) >= 2:
            category = cats[0]
            sub_category = cats[-1]
        elif len(cats) == 1:
            category = cats[0]

    # 日期、浏览量、ID
    date_str = ''
    views = 0
    ad_id = ''
    date_ul = soup.find('ul', class_='date-click')
    if date_ul:
        lis = date_ul.find_all('li')
        for li in lis:
            text = li.get_text(strip=True)
            if re.match(r'\d{4}/\d{2}/\d{2}', text):
                date_str = text
            elif '次浏览' in text or 'views' in text.lower():
                m = re.search(r'(\d+)', text)
                if m:
                    views = int(m.group(1))
            elif '广告ID' in text or 'ID:' in text:
                m = re.search(r'(\d+)', text)
                if m:
                    ad_id = m.group(1)

    # 联系信息
    contact_person = ''
    phone = ''
    other_phone = ''
    email = ''
    wechat = ''

    contact_lists = soup.find_all('div', class_='contact-box-list')
    for cl in contact_lists:
        b_tag = cl.find('b')
        p_tag = cl.find('p')
        label = b_tag.get_text(strip=True) if b_tag else ''
        value = p_tag.get_text(strip=True) if p_tag else ''
        if '联系人' in label:
            contact_person = value.split()[0] if value else ''  # 只取名字，去掉语言
        elif '联系电话' in label:
            phone = value
        elif '其他电话' in label:
            other_phone = value
        elif '电子邮箱' in label:
            email = value
        elif '微信账号' in label or '微信' in label:
            wechat = value

    # 地址和区域
    address = ''
    area = ''
    addr_div = soup.find('div', class_='addr_list')
    if addr_div:
        addr_p = addr_div.find('p', class_='addrs')
        if addr_p:
            address = addr_p.get('title') or addr_p.get_text(strip=True)
        area_span = addr_div.find('span', class_='area')
        if area_span:
            area = area_span.get_text(strip=True)

    # 详细描述正文
    desc_article = soup.find('article', class_='info-detail-content')
    description = ''
    images = []
    if desc_article:
        # 提取纯文本描述
        content_table = desc_article.find('table', id='infos_content_table')
        if content_table:
            # 去掉图片标签后取文本
            for img in content_table.find_all('img'):
                src = img.get('data-original') or img.get('src') or ''
                if src and 'nopic' not in src:
                    images.append(src)
                img.decompose()  # 移除img标签
            description = content_table.get_text(separator='\n', strip=True)
            # 清理多余空白
            description = re.sub(r'\n{3,}', '\n\n', description).strip()

    # 兜底：从描述文本中提取电话（很多页面联系区域没有电话字段）
    if not phone and description:
        phone_patterns = [
            r'(?:电话|TEL|tel|Tel|联系电话|手机|预定电话|咨询|垂询|联系|Contact|Phone)[：:\s]*(\(?[\d]{2,4}\)?[-\s]?[\d]{3,4}[-\s]?[\d]{3,4}\s*(?:分机|x|ext\.?)?\s*[\d]*)',
            r'(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})',  # (604) 123-4567 / 604-123-4567 / 604.123.4567
            r'(\d{10,11})',  # 纯数字 10-11位（如 2364777777）
        ]
        for pat in phone_patterns:
            m = re.search(pat, description)
            if m:
                found = m.group(1)
                # 过滤掉明显不是电话的数字（如年份、金额）
                if len(found) >= 7 and not (found.startswith('18') or found.startswith('19') or found.startswith('20')):
                    phone = found
                    break

    # 图片列表（从全部图片区域补充）
    pics_ul = soup.find('ul', id='show_more_pics')
    if pics_ul:
        for img in pics_ul.find_all('img'):
            src = img.get('data-original') or img.get('src') or ''
            if src and 'nopic' not in src and src not in images:
                images.append(src)

    return {
        'id': ad_id,
        'title': title,
        'category': category,
        'sub_category': sub_category,
        'date': date_str,
        'views': views,
        'contact': contact_person,
        'phone': phone,
        'other_phone': other_phone,
        'email': email,
        'wechat': wechat,
        'address': address,
        'area': area,
        'description': description[:2000] if description else '',  # 截断过长描述
        'images': images[:10],  # 最多保留10张图
        'source_file': os.path.basename(filepath),
    }


def main():
    all_data = []
    seen_ids = set()
    success = 0
    fail = 0

    # 遍历所有 page_* 文件夹
    page_folders = sorted(
        [d for d in os.listdir(BASE_DIR) if d.startswith('page_')],
        key=lambda x: int(x.replace('page_', ''))
    )

    for folder in page_folders:
        folder_path = os.path.join(BASE_DIR, folder)
        if not os.path.isdir(folder_path):
            continue

        detail_files = [f for f in os.listdir(folder_path) if f.startswith('detail_') and f.endswith('.html')]
        print(f"\n📂 {folder}: {len(detail_files)} 个详情页")

        for fname in sorted(detail_files):
            fpath = os.path.join(folder_path, fname)
            item = parse_detail(fpath)

            if item and item['title']:
                # 去重：按ad_id去重
                item_key = item['id'] or item['title']
                if item_key not in seen_ids:
                    seen_ids.add(item_key)
                    all_data.append(item)
                    success += 1
                else:
                    fail += 1
            else:
                fail += 1

    # 按日期排序（新的在前）
    all_data.sort(key=lambda x: x.get('date', ''), reverse=True)

    output_path = os.path.join(BASE_DIR, 'data.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"✅ 解析完成！")
    print(f"   成功: {success} 条")
    print(f"   重复/失败: {fail} 条")
    print(f"   有效数据: {len(all_data)} 条")
    print(f"   输出文件: {output_path}")

    # 统计分类分布
    cat_count = {}
    area_count = {}
    for item in all_data:
        c = item.get('category', '未知')
        cat_count[c] = cat_count.get(c, 0) + 1
        a = item.get('area', '未知')
        area_count[a] = area_count.get(a, 0) + 1

    print(f"\n📊 分类分布:")
    for c, n in sorted(cat_count.items(), key=lambda x: -x[1])[:15]:
        print(f"   {c}: {n}")

    print(f"\n📍 地区分布:")
    for a, n in sorted(area_count.items(), key=lambda x: -x[1])[:10]:
        print(f"   {a}: {n}")


if __name__ == '__main__':
    main()
