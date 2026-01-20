const skills = [
    {
        title: "数据炼金术师",
        description: "自动清理原始 CSV 数据，并利用 Python 直接生成交互式可视化图表。",
        tags: ["Python", "Analysis"],
        icon: "bar-chart-3",
        color: "blue",
        skill: `### 数据炼金术师技能

**核心能力：**
- 自动识别并修复 CSV 数据中的缺失值、重复项和格式错误
- 使用 Pandas 进行数据清洗和预处理
- 生成 Matplotlib/Seaborn 交互式可视化图表
- 自动生成数据分析报告

**使用方法：**

data_cleaning_agent = DataAlchemist()
cleaned_data = data_cleaning_agent.process("raw_data.csv")
visualizations = data_cleaning_agent.generate_charts(cleaned_data)
report = data_cleaning_agent.create_report(visualizations)
`
    },
    {
        title: "代码架构师",
        description: "遵循企业级规范进行代码重构，支持 React/Next.js 最佳实践检查。",
        tags: ["Engineering", "React"],
        icon: "code-2",
        color: "purple",
        skill: `### 代码架构师技能

**核心能力：**
- 自动识别代码中的反模式和技术债务
- 遵循 SOLID 原则进行代码重构
- React/Next.js 最佳实践检查
- 生成代码质量报告和优化建议

**使用方法：**

architect = CodeArchitect()
analysis = architect.analyze("src/")
refactored_code = architect.refactor(analysis)
report = architect.generate_quality_report()
`
    },
    {
        title: "SEO 内容大师",
        description: "针对特定关键词优化长篇文章，自动生成符合算法偏好的 Meta 标签。",
        tags: ["Marketing", "Copywriting"],
        icon: "pen-tool",
        color: "emerald",
        skill: `### SEO 内容大师技能

**核心能力：**
- 关键词研究和竞争分析
- 长篇文章 SEO 优化
- Meta 标签和结构化数据生成
- 内容可读性和语义分析

**使用方法：**

seo_expert = SEOContentMaster()
keywords = seo_expert.research("人工智能")
optimized_content = seo_expert.optimize("article.md", keywords)
meta_tags = seo_expert.generate_meta_tags(optimized_content)
`
    },
    {
        title: "PDF 智囊",
        description: "快速扫描数百页法律文档，提取关键条款并进行多维度的合规性对比。",
        tags: ["PDF", "Logic"],
        icon: "file-search",
        color: "orange",
        skill: `### PDF 智囊技能

**核心能力：**
- 批量 PDF 文本提取和解析
- 法律条款识别和分类
- 多文档合规性对比分析
- 自动生成摘要和关键要点

**使用方法：**

pdf_analyst = PDFThinkTank()
documents = pdf_analyst.load("contracts/")
clauses = pdf_analyst.extract_clauses(documents)
comparison = pdf_analyst.compare_compliance(clauses)
`
    },
    {
        title: "多语言翻译官",
        description: "不仅是翻译，更包含文化润色。支持 50+ 语言的母语级风格转化。",
        tags: ["Linguistics", "Global"],
        icon: "languages",
        color: "pink",
        skill: `### 多语言翻译官技能

**核心能力：**
- 50+ 语言之间的精准翻译
- 文化适配和母语级润色
- 专业领域术语库支持
- 批量文档翻译和格式保留

**使用方法：**

translator = MultilingualTranslator()
translated_text = translator.translate("document.txt", "zh", "en")
localized_content = translator.localize(translated_text, "US")
`
    }
];

// 导出技能数据以便在 HTML 中使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = skills;
}