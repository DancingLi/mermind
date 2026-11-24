import type { DiagramKind } from '../types';

export interface DiagramTemplate {
  id: string;
  kind: DiagramKind;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  code: { zh: string; en: string };
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'mindmap-blank',
    kind: 'mindmap',
    name: { zh: '空白思维导图', en: 'Blank Mindmap' },
    description: {
      zh: '极简起点，选中根节点按 Tab 即可开始发散想法',
      en: 'Minimal starter — press Tab on the root node to brainstorm',
    },
    code: {
      zh: `mindmap
  root((中心主题))
    分支主题 1
      子主题 1.1
    分支主题 2
      子主题 2.1`,
      en: `mindmap
  root((Central Topic))
    Branch 1
      Subtopic 1.1
    Branch 2
      Subtopic 2.1`,
    },
  },
  {
    id: 'flowchart-blank',
    kind: 'flowchart',
    name: { zh: '空白流程图', en: 'Blank Flowchart' },
    description: {
      zh: '极简起点，选中节点按 Tab 延伸下游、Enter 新增分支或拖拽连线',
      en: 'Minimal starter — press Tab for downstream, Enter for branch, or drag handles',
    },
    code: {
      zh: `flowchart TD
  Start([开始]) --> Step1[步骤 1]`,
      en: `flowchart TD
  Start([Start]) --> Step1[Step 1]`,
    },
  },
  {
    id: 'other-sequence-blank',
    kind: 'other',
    name: { zh: '空白时序图', en: 'Blank Sequence Diagram' },
    description: {
      zh: '极简时序图起点，直接在左侧编辑参与角色与交互消息并实时预览',
      en: 'Minimal sequence diagram starter — edit participants and messages with live preview',
    },
    code: {
      zh: `sequenceDiagram
  participant A as 角色 A
  participant B as 角色 B
  A->>B: 发送消息
  B-->>A: 返回响应`,
      en: `sequenceDiagram
  participant A as Actor A
  participant B as Actor B
  A->>B: Send message
  B-->>A: Return response`,
    },
  },
  {
    id: 'mindmap-product',
    kind: 'mindmap',
    name: { zh: '产品规划思维导图', en: 'Product Roadmap Mindmap' },
    description: {
      zh: '包含多级分支与多种节点形状，支持 Tab / Enter 快速扩展',
      en: 'Multi-level mindmap with varied node shapes and Tab / Enter editing',
    },
    code: {
      zh: `mindmap
  root((Mermind 产品规划))
    核心定位
      sync["双向同步：代码 ⇄ 可视化画布"]
      fmt(".mmd 原生纯文本存储")
      plat("跨平台：macOS & Windows")
    可视化体验
      思维导图
        Tab 新增子节点
        Enter 新增同级节点
        拖拽重组父子层级
      流程图
        自由拖拽连线
        子图分组管理
        一键整理自动布局
    导出与协作
      矢量 SVG 与高清 PNG
      PDF 打印文档
      Markdown 大纲同步`,
      en: `mindmap
  root((Mermind Product Plan))
    Core Vision
      sync["Bidirectional Sync: Code ⇄ Visual"]
      fmt(".mmd Native Plain Text")
      plat("Cross-Platform: macOS & Windows")
    Visual Studio
      Mindmap Mode
        Tab adds child node
        Enter adds sibling node
        Drag to reparent nodes
      Flowchart Mode
        Visual handle connections
        Subgraph grouping
        One-click auto tidy
    Export & Share
      Crisp SVG & HiDPI PNG
      PDF Document Export
      Markdown Outline Copy`,
    },
  },
  {
    id: 'flowchart-approval',
    kind: 'flowchart',
    name: { zh: '需求评审流程图', en: 'Feature Review Flowchart' },
    description: {
      zh: '包含条件判断、子图分组、不同连线样式与节点着色',
      en: 'Decision branches, subgraph container, styled edges, and custom colors',
    },
    code: {
      zh: `flowchart TD
  Start([提交需求提案]) --> Review{方案可行性评估}
  Review -->|通过| Design[输出交互与技术方案]
  Review -->|需补充| Revise[完善需求文档]
  Revise -.-> Start

  subgraph Dev[研发交付阶段]
    Design --> Impl[功能开发与联调]
    Impl --> QA{测试验收}
    QA -->|修复缺陷| Impl
  end

  QA -->|验收通过| Release([正式发布上线])

  style Start fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  style Release fill:#dcfce7,stroke:#16a34a,color:#14532d`,
      en: `flowchart TD
  Start([Submit Proposal]) --> Review{Feasibility Check}
  Review -->|Approved| Design[Design & Tech Spec]
  Review -->|Needs Info| Revise[Refine Requirements]
  Revise -.-> Start

  subgraph Dev[Engineering Delivery]
    Design --> Impl[Implementation]
    Impl --> QA{QA Verification}
    QA -->|Fix Bugs| Impl
  end

  QA -->|Passed| Release([Ship to Production])

  style Start fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  style Release fill:#dcfce7,stroke:#16a34a,color:#14532d`,
    },
  },
  {
    id: 'flowchart-arch',
    kind: 'flowchart',
    name: { zh: '横向系统架构图', en: 'System Architecture Flow' },
    description: {
      zh: 'LR 从左向右流向，含数据库与微服务分组',
      en: 'Left-to-right system flow with services and database shapes',
    },
    code: {
      zh: `flowchart LR
  Client([桌面端 / Web]) --> Gateway[API 网关]
  subgraph Backend[核心服务层]
    Gateway --> Auth[鉴权服务]
    Gateway --> Core[业务引擎]
  end
  Core --> Cache[(Redis 缓存)]
  Core ==> DB[(PostgreSQL 主库)]`,
      en: `flowchart LR
  Client([Desktop / Web]) --> Gateway[API Gateway]
  subgraph Backend[Core Services]
    Gateway --> Auth[Auth Service]
    Gateway --> Core[Core Engine]
  end
  Core --> Cache[(Redis Cache)]
  Core ==> DB[(PostgreSQL)]`,
    },
  },
  {
    id: 'other-sequence',
    kind: 'other',
    name: { zh: '时序图示例（原生预览）', en: 'Sequence Diagram (Preview)' },
    description: {
      zh: '展示其他 Mermaid 图表的代码编辑、原生预览与导出能力',
      en: 'Demonstrates live code preview & export for other Mermaid diagrams',
    },
    code: {
      zh: `sequenceDiagram
  autonumber
  actor User as 用户
  participant Canvas as 可视化画布
  participant AST as Mermaid 引擎
  participant Code as 代码编辑器

  User->>Canvas: 按 Tab 新增子节点
  Canvas->>AST: 执行 addChild 操作
  AST-->>Code: 实时同步标准 Mermaid 代码
  Code-->>User: 高亮展示最新源码`,
      en: `sequenceDiagram
  autonumber
  actor User
  participant Canvas as Visual Canvas
  participant AST as Mermaid Engine
  participant Code as Code Editor

  User->>Canvas: Press Tab to add child
  Canvas->>AST: Apply addChild mutation
  AST-->>Code: Serialize standard Mermaid code
  Code-->>User: Live syntax-highlighted update`,
    },
  },
];

export function getTemplateById(id: string): DiagramTemplate {
  return DIAGRAM_TEMPLATES.find((t) => t.id === id) ?? DIAGRAM_TEMPLATES[0];
}
