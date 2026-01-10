export const categories = [
  {
    id: 'ai-ml',
    name: 'AI & ML',
    description: 'Modeling, language AI, and applied ML workflows.',
    color: '#0f766e'
  },
  {
    id: 'data-analytics',
    name: 'Data & Analytics',
    description: 'Data stores, pipelines, and business intelligence.',
    color: '#2563eb'
  },
  {
    id: 'cloud-infra',
    name: 'Cloud & Infrastructure',
    description: 'Cloud services, compute, and foundational platforms.',
    color: '#0ea5e9'
  },
  {
    id: 'devops',
    name: 'DevOps & Platform',
    description: 'CI/CD, developer platforms, and delivery tooling.',
    color: '#f97316'
  },
  {
    id: 'security',
    name: 'Security & Compliance',
    description: 'Security controls, scanning, and compliance tooling.',
    color: '#dc2626'
  },
  {
    id: 'identity',
    name: 'Identity & Access',
    description: 'SSO, IAM, and access control patterns.',
    color: '#0ea5e9'
  },
  {
    id: 'frontend',
    name: 'Frontend & UX',
    description: 'User-facing frameworks, design systems, and UI tech.',
    color: '#10b981'
  },
  {
    id: 'backend',
    name: 'Backend & Runtime',
    description: 'Languages, runtimes, and service-layer concerns.',
    color: '#6b7280'
  },
  {
    id: 'integration',
    name: 'Integration & Messaging',
    description: 'API management, queues, and streaming.',
    color: '#f43f5e'
  },
  {
    id: 'testing',
    name: 'Testing & Quality',
    description: 'Quality practices and testing frameworks.',
    color: '#16a34a'
  },
  {
    id: 'observability',
    name: 'Monitoring & Observability',
    description: 'Metrics, logs, dashboards, and runtime insight.',
    color: '#f59e0b'
  },
  {
    id: 'collaboration',
    name: 'Collaboration & Work Management',
    description: 'Work tracking and team collaboration platforms.',
    color: '#1d4ed8'
  },
  {
    id: 'architecture',
    name: 'Architecture & Delivery Practices',
    description: 'System patterns and delivery methodologies.',
    color: '#0f172a'
  },
  {
    id: 'ide',
    name: 'IDE & Developer Tools',
    description: 'Developer workspaces and specialized IDEs.',
    color: '#64748b'
  }
]

export const types = [
  'Capability',
  'Technique',
  'Pattern',
  'Practice',
  'Methodology',
  'Language',
  'Framework',
  'Library',
  'Tool',
  'Service',
  'Platform',
  'DataStore',
  'Runtime',
  'Standard',
  'Test Type'
]

const categoryTags = {
  'ai-ml': ['ai', 'ml'],
  'data-analytics': ['data', 'analytics'],
  'cloud-infra': ['cloud', 'infrastructure'],
  devops: ['devops', 'delivery'],
  security: ['security', 'compliance'],
  identity: ['identity', 'access'],
  frontend: ['frontend', 'ux'],
  backend: ['backend', 'services'],
  integration: ['integration', 'messaging'],
  testing: ['testing', 'quality'],
  observability: ['observability', 'monitoring'],
  collaboration: ['collaboration', 'work-management'],
  architecture: ['architecture', 'delivery'],
  ide: ['developer-tools']
}

const tagRules = [
  { pattern: /(lambda|step functions|eventbridge|serverless)/i, tags: ['serverless'] },
  {
    pattern: /(kubernetes|docker|eks|ecs|ecr|rancher|helm|kustomize)/i,
    tags: ['containers']
  },
  {
    pattern:
      /(s3|efs|rds|dynamodb|neptune|postgres|redis|snowflake|redshift|database|sql)/i,
    tags: ['data-store']
  },
  {
    pattern: /(sqs|sns|kinesis|kafka|rabbitmq|eventbridge|queue|stream)/i,
    tags: ['messaging']
  },
  {
    pattern: /(glue|airflow|dbt|spark|emr|athena|pipeline|etl)/i,
    tags: ['data-pipelines']
  },
  {
    pattern: /(looker|power bi|quicksight|superset|plotly|d3|snowsight|dashboard)/i,
    tags: ['bi']
  },
  {
    pattern: /(api|gateway|apigee|openapi|grpc|endpoint)/i,
    tags: ['api']
  },
  {
    pattern:
      /(sast|sca|dast|guardduty|waf|shield|kms|secrets|vault|zero trust|security|inspector|cloudtrail|config|stig)/i,
    tags: ['security']
  },
  {
    pattern: /(iam|oauth|openid|saml|cognito|okta|entra|adfs)/i,
    tags: ['identity']
  },
  {
    pattern:
      /(llm|embedding|ner|nlp|pytorch|tensorflow|scikit|xgboost|mlflow|sagemaker|topic|anomaly|fraud|pca)/i,
    tags: ['ml']
  },
  {
    pattern:
      /(prometheus|grafana|cloudwatch|splunk|new relic|opentelemetry|x-ray|fluent|monitor)/i,
    tags: ['observability']
  },
  {
    pattern: /(jenkins|github|harness|ci\/cd|terraform|cloudformation|ansible|backstage)/i,
    tags: ['delivery']
  },
  {
    pattern: /(pytest|junit|cypress|playwright|selenium|jmeter|locust|test)/i,
    tags: ['testing']
  },
  {
    pattern:
      /(fedramp|control tower|organizations|guardrails|rbac|permission boundaries|compliance|dora)/i,
    tags: ['governance']
  }
]

const ossRegex =
  /(Apache|Kubernetes|Docker|Helm|Kustomize|Prometheus|Grafana|OpenTelemetry|OpenSearch|Kafka|RabbitMQ|Airflow|Superset|Fluent|Terraform|Ansible|Jenkins|Backstage|Python|Java|Go|React|Next\.js|TypeScript|Django|Flask|FastAPI|Express|PyTorch|TensorFlow|scikit-learn|XGBoost|spaCy|pandas|FAISS|Gensim|D3\.js|Plotly|Selenium|Playwright|Cypress|pytest|JUnit|Locust|JMeter|OpenSCAP|Trivy|OWASP|Open Policy Agent|Vault|dbt)/i

const isAwsItem = (item) =>
  item.id.startsWith('aws-') || /^AWS\b/i.test(item.name) || /^Amazon\b/i.test(item.name)

const buildTags = (item) => {
  const tags = new Set(item.tags || [])
  const usageTags = categoryTags[item.category] || []
  usageTags.forEach((tag) => tags.add(tag))

  const haystack = [
    item.name,
    item.id,
    ...(item.synonyms || []),
    ...(item.tags || [])
  ].join(' ')

  tagRules.forEach(({ pattern, tags: extraTags }) => {
    if (pattern.test(haystack)) {
      extraTags.forEach((tag) => tags.add(tag))
    }
  })

  if (isAwsItem(item)) {
    tags.add('aws')
  }

  if (ossRegex.test(haystack)) {
    tags.add('oss')
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

const descriptionById = {
  'dnn':
    'Multi-layer neural architectures for learning complex patterns; used for NLP, vision, and anomaly detection workloads.',
  'nlp':
    'Field focused on extracting meaning from text and speech; used for document classification, search, and summarization.',
  'ner':
    'Sequence labeling approach that identifies people, places, and organizations in text; used in document extraction and knowledge graph building.',
  'topic-modeling':
    'Unsupervised method that groups documents into latent themes; used for corpus exploration and reporting.',
  'embeddings':
    'Vector representations of text that capture semantic similarity; used for search, clustering, and retrieval.',
  'contextual-embeddings':
    'Embedding approach that varies vector meaning by surrounding words; used for higher-quality semantic matching.',
  'pca':
    'Linear dimensionality reduction technique for projecting data into fewer components; used for feature reduction and exploratory analysis.',
  'supervised-learning':
    'Modeling approach that learns from labeled examples; used for classification and regression in operational analytics.',
  'fraud-classification':
    'Predictive scoring of transactions or claims to flag risk; used for program integrity monitoring.',
  'anomaly-detection':
    'Methods that identify outliers or unusual behavior; used for fraud, security, and data quality monitoring.',
  'gradient-boosting':
    'Ensemble method that builds additive decision trees; used for high-performing tabular models.',
  'random-forest':
    'Bagged decision-tree ensemble for robust classification and regression; used on structured datasets.',
  'genai':
    'Modeling paradigm that generates new text, images, or code; used for summarization, drafting, and assistance pilots.',
  'llms':
    'Large transformer models for text generation and reasoning; used for chat, summarization, and extraction tasks.',
  'llm-workflow':
    'Operational pattern that chains retrieval, prompts, and safety checks; used to integrate language models into business processes.',
  'zero-shot-learning':
    'Inference approach that predicts labels without task-specific training data; used for rapid text triage.',
  'gpt-architecture':
    'Autoregressive transformer design that predicts next tokens; used for generative text systems.',
  'custom-transformer':
    'Tailored attention-based model architectures; used when domain data or constraints require bespoke models.',
  'distributed-gpu-training':
    'Parallel training across multiple GPUs or nodes; used for large model training and fine-tuning.',
  'mlops':
    'Operational discipline for deploying, monitoring, and versioning models; used to keep ML in production stable and compliant.',
  'ml-models-fraud':
    'Predictive models targeting fraud and program integrity; used to prioritize investigations and reduce false positives.',
  'llm-detection':
    'Techniques that identify AI-generated text; used for policy enforcement and content provenance checks.',
  'pytorch':
    'Open-source deep learning framework with dynamic graphs; used for research and production training.',
  'tensorflow':
    'Open-source ML framework for training and serving models at scale; used in production pipelines.',
  'scikit-learn':
    'Python machine-learning toolkit for classical algorithms; used for baselines and tabular models.',
  'xgboost':
    'Gradient-boosted tree library optimized for performance; used for structured data scoring.',
  'spacy':
    'Industrial NLP library with pipelines and models; used for entity extraction and text processing.',
  'gensim-word2vec':
    'Library for training word vectors from large corpora; used to build embeddings for similarity tasks.',
  'faiss':
    'Vector similarity search library for nearest-neighbor queries; used for semantic search and retrieval.',
  'hugging-face':
    'Model hub and tooling ecosystem for sharing and deploying ML models; used for rapid prototyping and evaluation.',
  'mlflow':
    'Model lifecycle tracking and registry tool; used for experiment tracking and deployment governance.',
  'aws-sagemaker':
    'Managed platform for training, tuning, and hosting ML models; used for scalable ML operations in regulated environments.',
  'aws-sagemaker-studio':
    'Browser-based IDE for notebooks and ML workflows; used by data scientists for experiment work.',
  'aws-sagemaker-pipelines':
    'Managed pipeline orchestration for ML workflows; used for repeatable training and deployment.',
  'aws-sagemaker-workflows':
    'Workflow orchestration with approvals for ML processes; used to coordinate training and deployment steps.',
  'aws-bedrock':
    'Managed foundation-model service with vetted providers; used to access LLMs without hosting infrastructure.',
  'claude-3-7':
    'Large language model from Anthropic; used for summarization, analysis, and drafting tasks.',
  'titan-embeddings':
    'Foundation embedding model for text similarity; used for semantic search and retrieval.',
  'aws-textract':
    'OCR service for extracting text and forms from documents; used for intake automation.',
  'aws-comprehend':
    'Managed NLP service for entities, sentiment, and classification; used for document analytics.',
  'sql':
    'Declarative query language for relational data; used for reporting, analytics, and ETL.',
  'parquet':
    'Columnar storage format optimized for analytics; used in data lakes and distributed processing.',
  'pandas':
    'Python data analysis library for tabular manipulation; used for data prep and analysis scripts.',
  'postgres':
    'Open-source relational database with strong SQL support; used for transactional and reporting workloads.',
  'redis':
    'In-memory key-value store for caching and queues; used for session storage and fast lookups.',
  'snowflake':
    'Cloud data warehouse with separate compute and storage; used for enterprise analytics and data sharing.',
  'snowsight':
    'Browser UI for running queries and managing the warehouse; used by analysts for exploration.',
  'aws-redshift':
    'Managed columnar data warehouse for large analytic workloads; used for structured reporting at scale.',
  'athena':
    'Serverless SQL query service over object storage; used for ad-hoc analytics on data lakes.',
  'glue':
    'Managed ETL service with data catalog and Spark jobs; used to build pipelines.',
  'glue-databrew':
    'Visual data preparation tool for profiling and cleaning; used by analysts without code.',
  'lake-formation':
    'Data lake governance service for access control and auditing; used to secure lake permissions.',
  'aws-emr':
    'Managed cluster service for Hadoop and Spark; used for large-scale batch processing.',
  'apache-spark':
    'Distributed processing engine for batch and streaming; used for ETL and ML workloads.',
  'neptune':
    'Managed graph database for highly connected data; used for relationship analytics and entity resolution.',
  'opensearch':
    'Open-source search and analytics engine; used for log search and operational analytics.',
  'opensearch-dashboards':
    'Web UI for exploring search indices and dashboards; used for interactive log and metric views.',
  'apache-airflow':
    'Workflow scheduler for DAG-based pipelines; used to orchestrate ETL jobs.',
  'dbt':
    'SQL transformation tool with versioned models; used to manage analytics transformations.',
  'great-expectations':
    'Data quality testing framework; used to validate datasets and pipelines.',
  'emr-studio':
    'Notebook-based workspace for Spark on managed clusters; used for collaborative data engineering.',
  'looker':
    'BI platform with a modeling layer for metrics; used to deliver governed dashboards.',
  'powerbi':
    'Microsoft BI suite for reports and dashboards; used widely across agencies.',
  'quicksight':
    'Managed BI dashboard service; used for lightweight reporting without infrastructure.',
  'apache-superset':
    'Open-source dashboarding and exploration tool; used for ad-hoc analytics.',
  'd3':
    'Low-level JavaScript visualization library; used to build bespoke charts.',
  'plotly':
    'Interactive charting library; used in web dashboards and notebooks.',
  'semantic-layer':
    'Modeling layer that standardizes business definitions; used to keep metrics consistent.',
  'governed-queries':
    'Governance process for approving shared queries; used to align analytics with program definitions.',
  'hub-spoke-data':
    'Integration pattern with a central hub and multiple sources; used to unify data domains.',
  'data-pipelines':
    'Automated flows that ingest, transform, and load data; used for recurring ETL.',
  'cloud-analytics-platform':
    'Bundled analytics stack combining storage, compute, and BI; used for enterprise reporting and data sharing.',
  'aws':
    'Public cloud provider offering compute, storage, networking, and managed services; commonly used for FedRAMP-aligned hosting.',
  'fedramp-cloud':
    'Federal security authorization for cloud environments; used to certify hosting for federal data.',
  'aws-organizations':
    'Multi-account management service for centralized governance and billing; used to apply guardrails across accounts.',
  'aws-control-tower':
    'Landing-zone automation for standardized account provisioning; used to enforce guardrails and baselines.',
  'aws-lambda':
    'Event-driven functions runtime that scales per request; used for serverless APIs and automation.',
  'aws-batch':
    'Managed batch scheduler for containerized jobs; used for large data processing and scheduled compute.',
  'aws-ecs':
    'Container orchestration service for tasks and services; used for long-running containers.',
  'aws-ecr':
    'Managed container registry with image scanning; used to store and distribute images.',
  'aws-eks':
    'Managed Kubernetes control plane; used for orchestrating container clusters in regulated environments.',
  'aws-ec2':
    'Virtual machine compute with full OS control; used for legacy apps and custom workloads.',
  'aws-vpc':
    'Virtual network isolation for subnets and routing; used to segment workloads securely.',
  'aws-security-groups':
    'Stateful network firewall rules for instances; used to control inbound and outbound traffic.',
  'aws-alb':
    'Layer 7 load balancer for HTTP(S) traffic; used for routing and TLS termination.',
  'aws-cloudfront':
    'Content delivery network for caching and edge security; used to accelerate web apps.',
  'aws-route53':
    'Managed DNS and traffic routing service; used for domain hosting and failover.',
  'aws-s3':
    'Object storage for files and data lakes; used for backups, logs, and data sharing.',
  'aws-efs':
    'Managed NFS file system; used for shared storage across Linux instances.',
  'aws-dynamodb':
    'Managed key-value and document database; used for high-throughput, low-latency workloads.',
  'aws-systems-manager':
    'Operations suite for patching, inventory, and automation; used to manage fleets across environments.',
  'aws-appconfig':
    'Configuration and feature flag management service; used to safely roll out settings.',
  'aws-ssm-parameter-store':
    'Centralized parameter and secret storage; used for runtime configuration values.',
  'aws-rds':
    'Managed relational database service; used for transactional systems and reporting.',
  'docker':
    'Container runtime for packaging applications; used to build and ship services consistently.',
  'kubernetes':
    'Container orchestration platform for scheduling and scaling workloads; used for microservices deployments.',
  'rancher':
    'Cluster management platform for Kubernetes; used to manage multi-cluster operations.',
  'linux':
    'Open-source operating system used for servers and containers; common base for cloud workloads.',
  'landing-zone-accelerator':
    'Automation toolkit for building standardized landing zones; used to implement multi-account governance.',
  'cross-account-roles':
    'IAM pattern that allows secure access between accounts; used for shared services and automation.',
  'vpc-settings':
    'Network configuration practices for subnets, routing, and security groups; used to enforce segmentation.',
  'cloud-automation-platform':
    'Platform for provisioning and managing cloud resources; used to standardize infrastructure delivery.',
  'github':
    'Source control and collaboration platform; used for repositories, pull requests, and workflows.',
  'jenkins':
    'Automation server for CI/CD pipelines; used to build, test, and deploy.',
  'jenkins-templating-engine':
    'Pipeline templating library for standardized Jenkins jobs; used to scale CI configuration.',
  'nexus':
    'Artifact repository for binaries and packages; used to manage dependencies and releases.',
  'terraform':
    'Infrastructure-as-code tool for declarative provisioning; used to manage cloud resources.',
  'aws-cloudformation':
    'Infrastructure templating service for provisioning stacks; used to codify resources in templates.',
  'ansible':
    'Configuration management and automation tool; used for provisioning and patching.',
  'helm':
    'Package manager for Kubernetes; used to deploy charts and manage releases.',
  'kustomize':
    'Declarative customization tool for Kubernetes manifests; used to manage environment overlays.',
  'harness':
    'CI/CD platform with deployment governance; used for automated releases and approvals.',
  'backstage':
    'Developer portal for service catalog and templates; used to improve platform discoverability.',
  'sonarqube':
    'Static code quality and security analysis platform; used for code health and SAST reporting.',
  'trivy':
    'Container and dependency scanner; used for vulnerability and SBOM checks.',
  'openscap':
    'Compliance scanning tool for security baselines; used for configuration assessment.',
  'checkmarx':
    'Static application security testing suite; used for code vulnerability scanning.',
  'twistlock':
    'Container security platform for runtime and image scanning; used in Kubernetes environments.',
  'nexusiq':
    'Software composition analysis tool for open-source risk; used for dependency governance.',
  'sast':
    'Static analysis of source code; used to find vulnerabilities early in CI.',
  'sca':
    'Dependency risk analysis for open-source components; used for license and vulnerability tracking.',
  'dast':
    'Dynamic testing of running applications; used to find runtime vulnerabilities.',
  'owasp-zap':
    'Open-source web app scanner; used for dynamic security testing.',
  'aws-guardduty':
    'Managed threat detection using logs and flow data; used for continuous monitoring.',
  'aws-cloudtrail':
    'API audit logging service; used for compliance and investigations.',
  'aws-config':
    'Configuration history and compliance rules service; used to detect drift.',
  'aws-inspector':
    'Managed vulnerability scanning for instances and images; used for continuous assessments.',
  'aws-kms':
    'Key management service for encryption keys; used to encrypt data at rest.',
  'aws-secrets-manager':
    'Managed secrets storage with rotation; used for credentials and API keys.',
  'aws-waf':
    'Web application firewall for HTTP traffic; used to block common attacks.',
  'aws-shield':
    'DDoS protection service; used to protect public endpoints.',
  'opa':
    'Policy engine for authorization and compliance; used with Kubernetes and CI gates.',
  'disa-stig':
    'DoD hardening guidelines; used for system configuration baselines.',
  'aws-security-hub':
    'Security findings aggregation and compliance service; used to centralize alerts.',
  'zero-trust':
    'Security model that verifies every request; used for network segmentation and access control.',
  'defense-in-depth-iam':
    'Layered IAM controls combining roles, boundaries, and guardrails; used to reduce blast radius.',
  'rbac':
    'Access control model based on roles; used to manage permissions at scale.',
  'permission-boundaries':
    'IAM constraint mechanism for limiting role permissions; used to prevent privilege escalation.',
  'ou-controls':
    'Organizational unit policies for account grouping; used to apply guardrails by segment.',
  'iam-guardrails':
    'Preventative controls and policies for IAM; used to enforce least privilege.',
  'shift-left-security':
    'Practice of moving security checks into early SDLC stages; used in CI pipelines.',
  'vault':
    'Secrets management system with encryption and leasing; used to store sensitive credentials.',
  'okta':
    'Identity provider with SSO and MFA; used for workforce authentication.',
  'aws-iam':
    'Identity and access service for users, roles, and policies; used to manage permissions in the cloud.',
  'aws-cognito':
    'User directory and authentication service; used for application login and federation.',
  'adfs':
    'Federation service for on-prem SSO; used to integrate with Active Directory.',
  'entra-id':
    'Microsoft cloud identity platform; used for enterprise SSO and federation.',
  'oauth2':
    'Authorization framework for delegated access; used for API tokens and SSO.',
  'openid-connect':
    'Identity layer on top of OAuth 2.0; used for SSO login flows.',
  'saml':
    'XML-based federation standard for SSO; used for enterprise identity integration.',
  'iam':
    'Discipline and governance of identities, roles, and permissions; used to enforce least privilege.',
  'react':
    'Component-based UI library for building SPAs; used for interactive government web apps.',
  'nextjs':
    'React-based framework with routing and SSR; used for SEO and performance.',
  'typescript':
    'Typed superset of JavaScript; used to improve maintainability of frontend and backend code.',
  'uswds':
    'Federal design system for accessible UI patterns; used for government websites.',
  'css':
    'Style sheet language for web layouts; used to implement responsive designs.',
  'python':
    'General-purpose language favored for data processing and APIs; used in analytics and ML services.',
  'java':
    'JVM language used for enterprise services; common for large-scale backends.',
  'go':
    'Compiled language with strong concurrency; used for high-performance services.',
  'nodejs':
    'JavaScript runtime for server-side apps; used for APIs and tooling.',
  'spring-boot':
    'Opinionated Java framework for REST services; used for enterprise APIs.',
  'django':
    'Full-stack Python web framework; used for rapid API and web development.',
  'flask':
    'Lightweight Python web framework; used for small services and APIs.',
  'fastapi':
    'Python framework for high-performance APIs with type hints; used for data services.',
  'express':
    'Minimal Node.js web framework; used for API endpoints and middleware.',
  'grpc':
    'Binary RPC protocol with schema contracts; used for service-to-service communication.',
  'api-endpoints':
    'HTTP interfaces that expose service operations; used for integration between systems.',
  'multithreading':
    'Concurrency approach using multiple threads; used to improve throughput in CPU-bound work.',
  'microservices':
    'Architecture that decomposes systems into small services; used for independent scaling and deployment.',
  'loosely-coupled':
    'Design approach with minimal dependencies between components; used for resilience and change isolation.',
  'two-tier-monolith':
    'Architecture with presentation and data layers in a single deployable unit; common for legacy systems.',
  'object-oriented':
    'Programming paradigm based on classes and objects; used for modularizing complex systems.',
  'state-machine-architecture':
    'Workflow design that models steps as state transitions; used for serverless orchestration of tasks.',
  'feature-flags':
    'Runtime toggles for enabling features; used for safe rollout and experimentation.',
  'agile':
    'Iterative delivery methodology with frequent feedback; common in government digital services.',
  'mvp':
    'Delivery approach that ships the smallest usable capability; used to validate scope early.',
  'dora-metrics':
    'Set of delivery performance metrics (lead time, deploy frequency, MTTR, change fail); used to assess DevOps health.',
  'devsecops':
    'Integration of security into DevOps processes; used to automate compliance and testing.',
  'ci-cd':
    'Automated build/test/deploy pipelines; used to speed delivery and reduce errors.',
  'okrs':
    'Goal-setting framework with measurable outcomes; used for program alignment.',
  'aws-api-gateway':
    'Managed API front door with auth and throttling; used to publish REST and HTTP APIs.',
  'openapi':
    'API specification standard for describing endpoints and schemas; used for documentation and code generation.',
  'apigee':
    'API management platform with proxies and analytics; used for enterprise API governance.',
  'aws-sqs':
    'Managed queue service for decoupling workloads; used for asynchronous processing.',
  'aws-sns':
    'Managed pub/sub notification service; used for fan-out messaging.',
  'aws-eventbridge':
    'Event bus for routing events between services; used for event-driven architectures.',
  'aws-step-functions':
    'State machine orchestration service; used to coordinate serverless workflows.',
  'aws-kinesis':
    'Managed streaming ingestion service; used for real-time analytics and pipelines.',
  'kafka':
    'Distributed streaming platform for high-throughput events; used for log and event pipelines.',
  'rabbitmq':
    'Message broker with queues and exchanges; used for reliable messaging.',
  'unit-tests':
    'Isolated tests for individual functions or classes; used for fast feedback in CI.',
  'integration-tests':
    'Tests that validate interactions between components; used to catch contract issues.',
  'e2e-tests':
    'User-journey tests across the full stack; used to validate critical flows.',
  'load-tests':
    'Performance tests that apply sustained load; used to validate scalability.',
  'accessibility-tests':
    'Checks for accessibility compliance (Section 508); used to ensure usable interfaces.',
  'ui-unit-tests':
    'Component-level UI tests; used to validate rendering and logic.',
  'data-tests':
    'Validation checks for data accuracy and completeness; used in pipelines.',
  'junit':
    'Java testing framework; used for unit and integration tests.',
  'cypress':
    'Browser-based end-to-end testing framework; used for UI regression tests.',
  'playwright':
    'Cross-browser automation framework; used for end-to-end testing.',
  'selenium':
    'Browser automation suite; used for cross-browser testing.',
  'jmeter':
    'Load testing tool for HTTP and other protocols; used for performance testing.',
  'locust':
    'Python-based load testing tool; used for scalable performance tests.',
  'pytest':
    'Python testing framework; used for unit and integration tests.',
  'cloudwatch':
    'Managed metrics, logs, and alarms service; used for baseline monitoring in the cloud.',
  'cloudwatch-rum':
    'Real user monitoring for frontend performance; used to track client latency and errors.',
  'lambda-insights':
    'Runtime metrics and traces for serverless functions; used for performance tuning.',
  'newrelic':
    'APM and observability platform; used for application performance monitoring.',
  'splunk':
    'Log analytics and SIEM platform; used for security and operational monitoring.',
  'grafana':
    'Dashboarding tool for metrics and logs; used with Prometheus and cloud sources.',
  'prometheus':
    'Time-series metrics collection and alerting system; used to scrape service metrics.',
  'opentelemetry':
    'Open standard for telemetry instrumentation; used to export traces, metrics, and logs.',
  'fluent-bit':
    'Lightweight log forwarder and processor; used to ship logs to central stores.',
  'aws-xray':
    'Distributed tracing service for request flows; used to trace microservice calls.',
  'operational-dashboards':
    'Operational visibility dashboards; used to track system health and SLAs.',
  'security-dashboards':
    'Security-focused dashboards for alerts and compliance; used by SOC teams.',
  'jira':
    'Issue tracking and agile planning tool; used for backlog and sprint management.',
  'confluence':
    'Team wiki and documentation space; used for requirements and knowledge sharing.',
  'teams':
    'Chat and meeting platform; used for daily collaboration.',
  'sharepoint':
    'Document management and intranet platform; used for file sharing and approvals.',
  'coder':
    'Remote development environment platform; used to standardize dev workspaces.',
  'vs-code':
    'Popular code editor with extensions; used for daily development.',
  'cloud9':
    'Browser-based IDE tied to cloud instances; used for remote development.'
}

const rawItems = [
  {
    id: 'dnn',
    name: 'Deep Neural Networks',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['DNNs'],
    tags: ['deep learning']
  },
  {
    id: 'nlp',
    name: 'Natural Language Processing',
    category: 'ai-ml',
    type: 'Capability',
    synonyms: ['NLP'],
    tags: ['text', 'language'],
    commonWith: ['ner', 'topic-modeling', 'embeddings', 'zero-shot-learning']
  },
  {
    id: 'ner',
    name: 'Named Entity Recognition',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['NER'],
    parents: ['nlp'],
    tags: ['extraction']
  },
  {
    id: 'topic-modeling',
    name: 'Topic Modeling',
    category: 'ai-ml',
    type: 'Technique',
    parents: ['nlp'],
    tags: ['clustering']
  },
  {
    id: 'embeddings',
    name: 'Text Embeddings',
    category: 'ai-ml',
    type: 'Capability',
    synonyms: ['Document embeddings', 'Sentence embeddings'],
    tags: ['similarity'],
    commonWith: ['faiss', 'gensim-word2vec', 'titan-embeddings']
  },
  {
    id: 'contextual-embeddings',
    name: 'Contextual Text Embeddings',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['Textual embedding for contextual similarity'],
    parents: ['embeddings']
  },
  {
    id: 'pca',
    name: 'Principal Component Analysis',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['PCA']
  },
  {
    id: 'supervised-learning',
    name: 'Supervised Learning',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['Supervised learning for fraud classification'],
    commonWith: ['fraud-classification', 'gradient-boosting']
  },
  {
    id: 'fraud-classification',
    name: 'Fraud Classification',
    category: 'ai-ml',
    type: 'Capability',
    parents: ['supervised-learning']
  },
  {
    id: 'anomaly-detection',
    name: 'Anomaly Detection',
    category: 'ai-ml',
    type: 'Capability'
  },
  {
    id: 'gradient-boosting',
    name: 'Gradient Boosting',
    category: 'ai-ml',
    type: 'Technique',
    tags: ['ensembles']
  },
  {
    id: 'random-forest',
    name: 'Random Forest',
    category: 'ai-ml',
    type: 'Technique',
    tags: ['ensembles']
  },
  {
    id: 'genai',
    name: 'Generative AI',
    category: 'ai-ml',
    type: 'Capability',
    synonyms: ['GenAI'],
    commonWith: ['llms', 'aws-bedrock']
  },
  {
    id: 'llms',
    name: 'Large Language Models',
    category: 'ai-ml',
    type: 'Capability',
    synonyms: ['LLMs'],
    parents: ['genai'],
    commonWith: ['llm-workflow', 'gpt-architecture', 'custom-transformer']
  },
  {
    id: 'llm-workflow',
    name: 'LLM Processing Workflow',
    category: 'ai-ml',
    type: 'Practice',
    parents: ['llms']
  },
  {
    id: 'zero-shot-learning',
    name: 'Zero-shot Learning',
    category: 'ai-ml',
    type: 'Technique',
    parents: ['llms']
  },
  {
    id: 'gpt-architecture',
    name: 'GPT Architecture',
    category: 'ai-ml',
    type: 'Technique',
    synonyms: ['Autoregressive transformer'],
    parents: ['llms']
  },
  {
    id: 'custom-transformer',
    name: 'Custom Transformer with Self-Attention',
    category: 'ai-ml',
    type: 'Technique',
    parents: ['llms']
  },
  {
    id: 'distributed-gpu-training',
    name: 'Distributed GPU Training',
    category: 'ai-ml',
    type: 'Practice'
  },
  {
    id: 'mlops',
    name: 'MLOps',
    category: 'ai-ml',
    type: 'Practice',
    commonWith: ['mlflow', 'aws-sagemaker']
  },
  {
    id: 'ml-models-fraud',
    name: 'ML Models (Fraud and Program)',
    category: 'ai-ml',
    type: 'Capability'
  },
  {
    id: 'llm-detection',
    name: 'LLM Detection',
    category: 'ai-ml',
    type: 'Capability',
    commonWith: ['hugging-face']
  },
  {
    id: 'pytorch',
    name: 'PyTorch',
    category: 'ai-ml',
    type: 'Framework',
    commonWith: ['aws-sagemaker', 'distributed-gpu-training']
  },
  {
    id: 'tensorflow',
    name: 'TensorFlow',
    category: 'ai-ml',
    type: 'Framework'
  },
  {
    id: 'scikit-learn',
    name: 'scikit-learn',
    category: 'ai-ml',
    type: 'Library',
    commonWith: ['random-forest', 'gradient-boosting', 'pca']
  },
  {
    id: 'xgboost',
    name: 'XGBoost',
    category: 'ai-ml',
    type: 'Library',
    parents: ['gradient-boosting']
  },
  {
    id: 'spacy',
    name: 'spaCy',
    category: 'ai-ml',
    type: 'Library',
    parents: ['nlp'],
    commonWith: ['ner']
  },
  {
    id: 'gensim-word2vec',
    name: 'Gensim word2vec',
    category: 'ai-ml',
    type: 'Library',
    parents: ['embeddings']
  },
  {
    id: 'faiss',
    name: 'FAISS',
    category: 'ai-ml',
    type: 'Library',
    parents: ['embeddings']
  },
  {
    id: 'hugging-face',
    name: 'Hugging Face',
    category: 'ai-ml',
    type: 'Platform',
    tags: ['models']
  },
  {
    id: 'mlflow',
    name: 'MLflow',
    category: 'ai-ml',
    type: 'Tool',
    parents: ['mlops']
  },
  {
    id: 'aws-sagemaker',
    name: 'AWS SageMaker',
    category: 'ai-ml',
    type: 'Platform',
    commonWith: ['aws-sagemaker-studio', 'aws-bedrock']
  },
  {
    id: 'aws-sagemaker-studio',
    name: 'AWS SageMaker Studio',
    category: 'ai-ml',
    type: 'Tool',
    parents: ['aws-sagemaker']
  },
  {
    id: 'aws-sagemaker-pipelines',
    name: 'AWS SageMaker Pipelines',
    category: 'ai-ml',
    type: 'Service',
    parents: ['aws-sagemaker']
  },
  {
    id: 'aws-sagemaker-workflows',
    name: 'AWS SageMaker Workflows',
    category: 'ai-ml',
    type: 'Service',
    parents: ['aws-sagemaker']
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    category: 'ai-ml',
    type: 'Service',
    commonWith: ['claude-3-7', 'titan-embeddings', 'llms']
  },
  {
    id: 'claude-3-7',
    name: 'Claude 3.7',
    category: 'ai-ml',
    type: 'Service',
    parents: ['llms'],
    synonyms: ['Claude 3.7 via AWS Bedrock']
  },
  {
    id: 'titan-embeddings',
    name: 'Titan Embeddings',
    category: 'ai-ml',
    type: 'Service',
    parents: ['embeddings'],
    synonyms: ['Titan Embeddings via AWS Bedrock']
  },
  {
    id: 'aws-textract',
    name: 'AWS Textract',
    category: 'ai-ml',
    type: 'Service',
    tags: ['pdf', 'ocr']
  },
  {
    id: 'aws-comprehend',
    name: 'AWS Comprehend',
    category: 'ai-ml',
    type: 'Service',
    tags: ['nlp']
  },
  {
    id: 'sql',
    name: 'SQL',
    category: 'data-analytics',
    type: 'Standard'
  },
  {
    id: 'parquet',
    name: 'Apache Parquet',
    category: 'data-analytics',
    type: 'Standard'
  },
  {
    id: 'pandas',
    name: 'pandas',
    category: 'data-analytics',
    type: 'Library',
    commonWith: ['python']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'data-analytics',
    type: 'DataStore',
    tags: ['relational'],
    synonyms: ['Postgres']
  },
  {
    id: 'redis',
    name: 'Redis',
    category: 'data-analytics',
    type: 'DataStore',
    tags: ['cache']
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    category: 'data-analytics',
    type: 'Platform',
    tags: ['warehouse']
  },
  {
    id: 'snowsight',
    name: 'SnowSight',
    category: 'data-analytics',
    type: 'Tool',
    parents: ['snowflake']
  },
  {
    id: 'aws-redshift',
    name: 'Amazon Redshift',
    category: 'data-analytics',
    type: 'Service',
    synonyms: ['Redshift'],
    tags: ['warehouse']
  },
  {
    id: 'athena',
    name: 'AWS Athena',
    category: 'data-analytics',
    type: 'Service'
  },
  {
    id: 'glue',
    name: 'AWS Glue',
    category: 'data-analytics',
    type: 'Service',
    tags: ['etl']
  },
  {
    id: 'glue-databrew',
    name: 'AWS Glue DataBrew',
    category: 'data-analytics',
    type: 'Service',
    parents: ['glue']
  },
  {
    id: 'lake-formation',
    name: 'AWS Lake Formation',
    category: 'data-analytics',
    type: 'Service'
  },
  {
    id: 'aws-emr',
    name: 'Amazon EMR',
    category: 'data-analytics',
    type: 'Service',
    synonyms: ['EMR'],
    commonWith: ['apache-spark']
  },
  {
    id: 'apache-spark',
    name: 'Apache Spark',
    category: 'data-analytics',
    type: 'Framework',
    commonWith: ['aws-emr', 'emr-studio']
  },
  {
    id: 'neptune',
    name: 'Amazon Neptune',
    category: 'data-analytics',
    type: 'DataStore',
    tags: ['graph']
  },
  {
    id: 'opensearch',
    name: 'OpenSearch',
    category: 'data-analytics',
    type: 'Platform',
    tags: ['search', 'analytics']
  },
  {
    id: 'opensearch-dashboards',
    name: 'OpenSearch Dashboards',
    category: 'data-analytics',
    type: 'Tool',
    parents: ['opensearch']
  },
  {
    id: 'apache-airflow',
    name: 'Apache Airflow',
    category: 'data-analytics',
    type: 'Tool',
    commonWith: ['data-pipelines']
  },
  {
    id: 'dbt',
    name: 'dbt',
    category: 'data-analytics',
    type: 'Tool',
    tags: ['transform']
  },
  {
    id: 'great-expectations',
    name: 'Great Expectations',
    category: 'data-analytics',
    type: 'Tool',
    tags: ['data quality'],
    commonWith: ['data-tests']
  },
  {
    id: 'emr-studio',
    name: 'AWS EMR Studio',
    category: 'data-analytics',
    type: 'Tool',
    parents: ['aws-emr'],
    synonyms: ['EMR Studio'],
    tags: ['spark']
  },
  {
    id: 'looker',
    name: 'Looker',
    category: 'data-analytics',
    type: 'Tool'
  },
  {
    id: 'powerbi',
    name: 'Power BI',
    category: 'data-analytics',
    type: 'Tool',
    synonyms: ['PowerBI']
  },
  {
    id: 'quicksight',
    name: 'Amazon QuickSight',
    category: 'data-analytics',
    type: 'Tool'
  },
  {
    id: 'apache-superset',
    name: 'Apache Superset',
    category: 'data-analytics',
    type: 'Tool'
  },
  {
    id: 'd3',
    name: 'D3.js',
    category: 'data-analytics',
    type: 'Library'
  },
  {
    id: 'plotly',
    name: 'Plotly',
    category: 'data-analytics',
    type: 'Library'
  },
  {
    id: 'semantic-layer',
    name: 'Semantic Layer',
    category: 'data-analytics',
    type: 'Pattern',
    tags: ['business objects']
  },
  {
    id: 'governed-queries',
    name: 'Governed Data Query Methodology',
    category: 'data-analytics',
    type: 'Practice'
  },
  {
    id: 'hub-spoke-data',
    name: 'Hub-and-spoke Data Integration',
    category: 'data-analytics',
    type: 'Pattern'
  },
  {
    id: 'data-pipelines',
    name: 'Data Pipelines',
    category: 'data-analytics',
    type: 'Pattern',
    synonyms: ['Data pipeline components'],
    commonWith: ['glue', 'hub-spoke-data']
  },
  {
    id: 'cloud-analytics-platform',
    name: 'Cloud Analytics Platform',
    category: 'data-analytics',
    type: 'Platform'
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    category: 'cloud-infra',
    type: 'Platform',
    synonyms: ['AWS'],
    commonWith: ['aws-ec2', 'aws-vpc', 'aws-s3']
  },
  {
    id: 'fedramp-cloud',
    name: 'FedRAMP-compliant Cloud',
    category: 'cloud-infra',
    type: 'Standard'
  },
  {
    id: 'aws-organizations',
    name: 'AWS Organizations',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Organizations'],
    commonWith: ['aws-control-tower', 'landing-zone-accelerator']
  },
  {
    id: 'aws-control-tower',
    name: 'AWS Control Tower',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Control Tower'],
    commonWith: ['aws-organizations', 'landing-zone-accelerator']
  },
  {
    id: 'aws-lambda',
    name: 'AWS Lambda',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Lambda'],
    commonWith: ['aws-sqs', 'aws-api-gateway', 'aws-step-functions']
  },
  {
    id: 'aws-batch',
    name: 'AWS Batch',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Batch jobs'],
    tags: ['batch', 'spot']
  },
  {
    id: 'aws-ecs',
    name: 'AWS ECS',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['ECS', 'Elastic Container Service']
  },
  {
    id: 'aws-ecr',
    name: 'Amazon ECR',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['ECR', 'Elastic Container Registry'],
    commonWith: ['docker', 'aws-ecs', 'aws-eks']
  },
  {
    id: 'aws-eks',
    name: 'AWS EKS',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['EKS', 'Elastic Kubernetes Service'],
    commonWith: ['kubernetes', 'docker']
  },
  {
    id: 'aws-ec2',
    name: 'AWS EC2',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['EC2']
  },
  {
    id: 'aws-vpc',
    name: 'AWS VPC',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['VPC'],
    commonWith: ['vpc-settings']
  },
  {
    id: 'aws-security-groups',
    name: 'AWS Security Groups',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Security Groups'],
    commonWith: ['aws-vpc']
  },
  {
    id: 'aws-alb',
    name: 'AWS Application Load Balancer',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['AWS ALB', 'ALB']
  },
  {
    id: 'aws-cloudfront',
    name: 'Amazon CloudFront',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['CloudFront']
  },
  {
    id: 'aws-route53',
    name: 'Amazon Route 53',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Route 53']
  },
  {
    id: 'aws-s3',
    name: 'Amazon S3',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['S3', 'S3 Buckets']
  },
  {
    id: 'aws-efs',
    name: 'Amazon EFS',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['EFS', 'Elastic File System']
  },
  {
    id: 'aws-dynamodb',
    name: 'Amazon DynamoDB',
    category: 'cloud-infra',
    type: 'DataStore',
    parents: ['aws'],
    synonyms: ['DynamoDB']
  },
  {
    id: 'aws-systems-manager',
    name: 'AWS Systems Manager',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['Systems Manager', 'SSM'],
    commonWith: ['aws-appconfig', 'aws-ssm-parameter-store']
  },
  {
    id: 'aws-appconfig',
    name: 'AWS AppConfig',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws-systems-manager'],
    synonyms: ['AppConfig'],
    commonWith: ['feature-flags']
  },
  {
    id: 'aws-ssm-parameter-store',
    name: 'AWS SSM Parameter Store',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws-systems-manager'],
    synonyms: ['SSM Parameter Store', 'Parameter Store', 'Config-Server']
  },
  {
    id: 'aws-rds',
    name: 'Amazon RDS',
    category: 'cloud-infra',
    type: 'Service',
    parents: ['aws'],
    synonyms: ['RDS']
  },
  {
    id: 'docker',
    name: 'Docker',
    category: 'cloud-infra',
    type: 'Tool',
    commonWith: ['kubernetes', 'aws-eks', 'aws-ecs', 'aws-ecr']
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'cloud-infra',
    type: 'Platform',
    commonWith: ['docker', 'rancher', 'helm', 'kustomize']
  },
  {
    id: 'rancher',
    name: 'Rancher',
    category: 'cloud-infra',
    type: 'Platform',
    commonWith: ['kubernetes']
  },
  {
    id: 'linux',
    name: 'Linux',
    category: 'cloud-infra',
    type: 'Platform'
  },
  {
    id: 'landing-zone-accelerator',
    name: 'Landing Zone Accelerator',
    category: 'cloud-infra',
    type: 'Practice',
    synonyms: ['LZA'],
    commonWith: ['aws-control-tower', 'aws-organizations']
  },
  {
    id: 'cross-account-roles',
    name: 'Cross-account Roles',
    category: 'cloud-infra',
    type: 'Practice'
  },
  {
    id: 'vpc-settings',
    name: 'VPC Settings',
    category: 'cloud-infra',
    type: 'Practice',
    commonWith: ['aws-vpc', 'aws-security-groups']
  },
  {
    id: 'cloud-automation-platform',
    name: 'Cloud Automation Platform',
    category: 'cloud-infra',
    type: 'Platform'
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'devops',
    type: 'Tool',
    commonWith: ['jenkins', 'nexus']
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    category: 'devops',
    type: 'Tool',
    commonWith: ['github', 'jenkins-templating-engine']
  },
  {
    id: 'jenkins-templating-engine',
    name: 'Jenkins Templating Engine',
    category: 'devops',
    type: 'Tool',
    parents: ['jenkins']
  },
  {
    id: 'nexus',
    name: 'Nexus Repository',
    category: 'devops',
    type: 'Tool',
    synonyms: ['Nexus']
  },
  {
    id: 'terraform',
    name: 'Terraform',
    category: 'devops',
    type: 'Tool',
    commonWith: ['aws', 'vault']
  },
  {
    id: 'aws-cloudformation',
    name: 'AWS CloudFormation',
    category: 'devops',
    type: 'Service',
    synonyms: ['CloudFormation'],
    commonWith: ['terraform', 'aws']
  },
  {
    id: 'ansible',
    name: 'Ansible',
    category: 'devops',
    type: 'Tool'
  },
  {
    id: 'helm',
    name: 'Helm',
    category: 'devops',
    type: 'Tool',
    commonWith: ['kubernetes']
  },
  {
    id: 'kustomize',
    name: 'Kustomize',
    category: 'devops',
    type: 'Tool',
    commonWith: ['kubernetes']
  },
  {
    id: 'harness',
    name: 'Harness',
    category: 'devops',
    type: 'Tool',
    tags: ['ci/cd']
  },
  {
    id: 'backstage',
    name: 'Backstage',
    category: 'devops',
    type: 'Tool',
    tags: ['developer portal']
  },
  {
    id: 'sonarqube',
    name: 'SonarQube',
    category: 'security',
    type: 'Tool',
    parents: ['sast'],
    tags: ['code quality']
  },
  {
    id: 'trivy',
    name: 'Trivy',
    category: 'security',
    type: 'Tool',
    parents: ['sca'],
    tags: ['container scanning'],
    commonWith: ['sca']
  },
  {
    id: 'openscap',
    name: 'OpenSCAP',
    category: 'security',
    type: 'Tool',
    synonyms: ['OpenScap']
  },
  {
    id: 'checkmarx',
    name: 'Checkmarx',
    category: 'security',
    type: 'Tool',
    parents: ['sast'],
    commonWith: ['sast']
  },
  {
    id: 'twistlock',
    name: 'Twistlock',
    category: 'security',
    type: 'Tool',
    tags: ['container security']
  },
  {
    id: 'nexusiq',
    name: 'NexusIQ',
    category: 'security',
    type: 'Tool',
    parents: ['sca'],
    commonWith: ['sca']
  },
  {
    id: 'sast',
    name: 'SAST',
    category: 'security',
    type: 'Capability',
    synonyms: ['Static Application Security Testing'],
    commonWith: ['checkmarx', 'sonarqube']
  },
  {
    id: 'sca',
    name: 'SCA',
    category: 'security',
    type: 'Capability',
    synonyms: ['Software Composition Analysis'],
    commonWith: ['trivy', 'nexusiq']
  },
  {
    id: 'dast',
    name: 'DAST',
    category: 'security',
    type: 'Capability',
    synonyms: ['Dynamic Application Security Testing'],
    commonWith: ['owasp-zap']
  },
  {
    id: 'owasp-zap',
    name: 'OWASP ZAP',
    category: 'security',
    type: 'Tool',
    parents: ['dast']
  },
  {
    id: 'aws-guardduty',
    name: 'AWS GuardDuty',
    category: 'security',
    type: 'Service',
    synonyms: ['GuardDuty'],
    commonWith: ['aws-security-hub', 'aws-cloudtrail']
  },
  {
    id: 'aws-cloudtrail',
    name: 'AWS CloudTrail',
    category: 'security',
    type: 'Service',
    synonyms: ['CloudTrail'],
    commonWith: ['aws-security-hub', 'aws-config']
  },
  {
    id: 'aws-config',
    name: 'AWS Config',
    category: 'security',
    type: 'Service',
    synonyms: ['Config'],
    commonWith: ['aws-security-hub', 'aws-cloudtrail']
  },
  {
    id: 'aws-inspector',
    name: 'AWS Inspector',
    category: 'security',
    type: 'Service',
    synonyms: ['Inspector'],
    commonWith: ['aws-security-hub']
  },
  {
    id: 'aws-kms',
    name: 'AWS KMS',
    category: 'security',
    type: 'Service',
    synonyms: ['KMS', 'Key Management Service'],
    commonWith: ['aws-secrets-manager']
  },
  {
    id: 'aws-secrets-manager',
    name: 'AWS Secrets Manager',
    category: 'security',
    type: 'Service',
    synonyms: ['Secrets Manager'],
    commonWith: ['aws-kms', 'vault']
  },
  {
    id: 'aws-waf',
    name: 'AWS WAF',
    category: 'security',
    type: 'Service',
    synonyms: ['WAF'],
    commonWith: ['aws-shield', 'aws-cloudfront']
  },
  {
    id: 'aws-shield',
    name: 'AWS Shield',
    category: 'security',
    type: 'Service',
    synonyms: ['Shield'],
    commonWith: ['aws-waf']
  },
  {
    id: 'opa',
    name: 'Open Policy Agent',
    category: 'security',
    type: 'Tool',
    synonyms: ['OPA'],
    commonWith: ['kubernetes']
  },
  {
    id: 'disa-stig',
    name: 'DISA STIGs',
    category: 'security',
    type: 'Standard',
    synonyms: ['STIG']
  },
  {
    id: 'aws-security-hub',
    name: 'AWS Security Hub',
    category: 'security',
    type: 'Service',
    commonWith: ['aws-guardduty', 'aws-config', 'aws-cloudtrail', 'aws-inspector']
  },
  {
    id: 'zero-trust',
    name: 'Zero Trust Network',
    category: 'security',
    type: 'Pattern'
  },
  {
    id: 'defense-in-depth-iam',
    name: 'Defense-in-depth IAM',
    category: 'security',
    type: 'Practice',
    tags: ['rbac', 'permission boundaries']
  },
  {
    id: 'rbac',
    name: 'Role-based Access Control',
    category: 'security',
    type: 'Standard',
    synonyms: ['RBAC']
  },
  {
    id: 'permission-boundaries',
    name: 'IAM Permission Boundaries',
    category: 'security',
    type: 'Practice'
  },
  {
    id: 'ou-controls',
    name: 'Organization Unit Controls',
    category: 'security',
    type: 'Practice'
  },
  {
    id: 'iam-guardrails',
    name: 'IAM Guardrails',
    category: 'security',
    type: 'Practice'
  },
  {
    id: 'shift-left-security',
    name: 'Shift-left Security',
    category: 'security',
    type: 'Practice',
    commonWith: ['sast', 'sca']
  },
  {
    id: 'vault',
    name: 'HashiCorp Vault',
    category: 'security',
    type: 'Tool',
    tags: ['secrets']
  },
  {
    id: 'okta',
    name: 'Okta',
    category: 'identity',
    type: 'Tool',
    commonWith: ['oauth2', 'entra-id']
  },
  {
    id: 'aws-iam',
    name: 'AWS IAM',
    category: 'identity',
    type: 'Service',
    parents: ['iam'],
    synonyms: ['IAM'],
    commonWith: ['aws-cognito', 'rbac', 'permission-boundaries']
  },
  {
    id: 'aws-cognito',
    name: 'AWS Cognito',
    category: 'identity',
    type: 'Service',
    parents: ['iam'],
    commonWith: ['oauth2', 'openid-connect', 'aws-iam']
  },
  {
    id: 'adfs',
    name: 'ADFS',
    category: 'identity',
    type: 'Service',
    synonyms: ['ADFS SSO']
  },
  {
    id: 'entra-id',
    name: 'Microsoft Entra ID',
    category: 'identity',
    type: 'Service',
    synonyms: ['Azure AD', 'identity federation']
  },
  {
    id: 'oauth2',
    name: 'OAuth 2.0',
    category: 'identity',
    type: 'Standard',
    synonyms: ['Okta/OAuth authentication']
  },
  {
    id: 'openid-connect',
    name: 'OpenID Connect',
    category: 'identity',
    type: 'Standard',
    synonyms: ['OIDC']
  },
  {
    id: 'saml',
    name: 'SAML 2.0',
    category: 'identity',
    type: 'Standard'
  },
  {
    id: 'iam',
    name: 'Identity and Access Management',
    category: 'identity',
    type: 'Practice',
    synonyms: ['IAM']
  },
  {
    id: 'react',
    name: 'React',
    category: 'frontend',
    type: 'Framework',
    commonWith: ['typescript', 'nextjs', 'uswds', 'css']
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'frontend',
    type: 'Framework'
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    category: 'frontend',
    type: 'Language'
  },
  {
    id: 'uswds',
    name: 'USWDS Design System',
    category: 'frontend',
    type: 'Standard',
    synonyms: ['U.S. Web Design System']
  },
  {
    id: 'css',
    name: 'CSS',
    category: 'frontend',
    type: 'Standard',
    synonyms: ['Responsive layouts']
  },
  {
    id: 'python',
    name: 'Python',
    category: 'backend',
    type: 'Language'
  },
  {
    id: 'java',
    name: 'Java',
    category: 'backend',
    type: 'Language'
  },
  {
    id: 'go',
    name: 'Go',
    category: 'backend',
    type: 'Language',
    synonyms: ['Golang']
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'backend',
    type: 'Runtime'
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot',
    category: 'backend',
    type: 'Framework',
    commonWith: ['java', 'api-endpoints']
  },
  {
    id: 'django',
    name: 'Django',
    category: 'backend',
    type: 'Framework',
    commonWith: ['python', 'api-endpoints']
  },
  {
    id: 'flask',
    name: 'Flask',
    category: 'backend',
    type: 'Framework',
    commonWith: ['python', 'api-endpoints']
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    category: 'backend',
    type: 'Framework',
    commonWith: ['python', 'api-endpoints']
  },
  {
    id: 'express',
    name: 'Express.js',
    category: 'backend',
    type: 'Framework',
    commonWith: ['nodejs', 'api-endpoints']
  },
  {
    id: 'grpc',
    name: 'gRPC',
    category: 'backend',
    type: 'Standard'
  },
  {
    id: 'api-endpoints',
    name: 'API Endpoints',
    category: 'backend',
    type: 'Pattern',
    commonWith: ['aws-api-gateway', 'apigee', 'openapi']
  },
  {
    id: 'multithreading',
    name: 'Multithreading',
    category: 'backend',
    type: 'Technique'
  },
  {
    id: 'microservices',
    name: 'Microservices Architecture',
    category: 'architecture',
    type: 'Pattern',
    commonWith: ['kubernetes', 'api-endpoints']
  },
  {
    id: 'loosely-coupled',
    name: 'Loosely Coupled Architecture',
    category: 'architecture',
    type: 'Pattern'
  },
  {
    id: 'two-tier-monolith',
    name: 'Two-tier Monolith',
    category: 'architecture',
    type: 'Pattern'
  },
  {
    id: 'object-oriented',
    name: 'Object-oriented Programming',
    category: 'architecture',
    type: 'Practice'
  },
  {
    id: 'state-machine-architecture',
    name: 'Serverless State Machine Architecture',
    category: 'architecture',
    type: 'Pattern',
    tags: ['lambda', 'sqs', 'decoupled'],
    commonWith: ['aws-step-functions', 'aws-lambda', 'aws-sqs']
  },
  {
    id: 'feature-flags',
    name: 'Feature Flags',
    category: 'architecture',
    type: 'Practice',
    commonWith: ['aws-appconfig']
  },
  {
    id: 'agile',
    name: 'Agile Methodology',
    category: 'architecture',
    type: 'Methodology'
  },
  {
    id: 'mvp',
    name: 'MVP Delivery',
    category: 'architecture',
    type: 'Methodology',
    synonyms: ['Minimum Viable Product']
  },
  {
    id: 'dora-metrics',
    name: 'DORA Metrics',
    category: 'architecture',
    type: 'Practice'
  },
  {
    id: 'devsecops',
    name: 'DevSecOps',
    category: 'architecture',
    type: 'Practice',
    commonWith: ['shift-left-security', 'ci-cd']
  },
  {
    id: 'ci-cd',
    name: 'CI/CD Pipelines',
    category: 'architecture',
    type: 'Practice',
    commonWith: ['jenkins', 'github', 'harness']
  },
  {
    id: 'okrs',
    name: 'OKRs',
    category: 'architecture',
    type: 'Methodology',
    synonyms: ['Objectives and Key Results']
  },
  {
    id: 'aws-api-gateway',
    name: 'AWS API Gateway',
    category: 'integration',
    type: 'Service',
    synonyms: ['API Gateway'],
    commonWith: ['openapi', 'aws-lambda']
  },
  {
    id: 'openapi',
    name: 'OpenAPI',
    category: 'integration',
    type: 'Standard',
    synonyms: ['Swagger']
  },
  {
    id: 'apigee',
    name: 'Apigee',
    category: 'integration',
    type: 'Platform'
  },
  {
    id: 'aws-sqs',
    name: 'Amazon SQS',
    category: 'integration',
    type: 'Service',
    synonyms: ['SQS'],
    commonWith: ['aws-lambda', 'aws-step-functions', 'aws-sns', 'kafka']
  },
  {
    id: 'aws-sns',
    name: 'Amazon SNS',
    category: 'integration',
    type: 'Service',
    synonyms: ['SNS'],
    commonWith: ['aws-sqs', 'aws-lambda']
  },
  {
    id: 'aws-eventbridge',
    name: 'Amazon EventBridge',
    category: 'integration',
    type: 'Service',
    synonyms: ['EventBridge'],
    commonWith: ['aws-lambda', 'aws-step-functions']
  },
  {
    id: 'aws-step-functions',
    name: 'AWS Step Functions',
    category: 'integration',
    type: 'Service',
    synonyms: ['Step Functions'],
    commonWith: ['aws-lambda', 'aws-sqs']
  },
  {
    id: 'aws-kinesis',
    name: 'Amazon Kinesis',
    category: 'integration',
    type: 'Service',
    synonyms: ['Kinesis'],
    commonWith: ['kafka']
  },
  {
    id: 'kafka',
    name: 'Kafka',
    category: 'integration',
    type: 'Platform',
    synonyms: ['Apache Kafka'],
    commonWith: ['aws-kinesis']
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    category: 'integration',
    type: 'Platform'
  },
  {
    id: 'unit-tests',
    name: 'Unit Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'integration-tests',
    name: 'Integration Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'e2e-tests',
    name: 'End-to-end Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'load-tests',
    name: 'Load and Performance Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'accessibility-tests',
    name: 'Accessibility and 508 Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'ui-unit-tests',
    name: 'UI Unit Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'data-tests',
    name: 'Data Tests',
    category: 'testing',
    type: 'Test Type'
  },
  {
    id: 'junit',
    name: 'JUnit',
    category: 'testing',
    type: 'Tool',
    parents: ['unit-tests']
  },
  {
    id: 'cypress',
    name: 'Cypress',
    category: 'testing',
    type: 'Tool',
    parents: ['e2e-tests']
  },
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'testing',
    type: 'Tool',
    parents: ['e2e-tests']
  },
  {
    id: 'selenium',
    name: 'Selenium',
    category: 'testing',
    type: 'Tool',
    parents: ['e2e-tests']
  },
  {
    id: 'jmeter',
    name: 'Apache JMeter',
    category: 'testing',
    type: 'Tool',
    parents: ['load-tests']
  },
  {
    id: 'locust',
    name: 'Locust',
    category: 'testing',
    type: 'Tool',
    parents: ['load-tests']
  },
  {
    id: 'pytest',
    name: 'pytest',
    category: 'testing',
    type: 'Tool',
    parents: ['unit-tests']
  },
  {
    id: 'cloudwatch',
    name: 'Amazon CloudWatch',
    category: 'observability',
    type: 'Service',
    synonyms: ['AWS CloudWatch', 'CloudWatch', 'Dashboards', 'Alarms'],
    commonWith: ['cloudwatch-rum', 'security-dashboards']
  },
  {
    id: 'cloudwatch-rum',
    name: 'CloudWatch RUM',
    category: 'observability',
    type: 'Service',
    parents: ['cloudwatch'],
    synonyms: ['Real User Monitoring']
  },
  {
    id: 'lambda-insights',
    name: 'AWS Lambda Insights',
    category: 'observability',
    type: 'Service'
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'observability',
    type: 'Tool',
    synonyms: ['NewRelic']
  },
  {
    id: 'splunk',
    name: 'Splunk',
    category: 'observability',
    type: 'Tool'
  },
  {
    id: 'grafana',
    name: 'Grafana',
    category: 'observability',
    type: 'Tool'
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    category: 'observability',
    type: 'Tool',
    commonWith: ['grafana']
  },
  {
    id: 'opentelemetry',
    name: 'OpenTelemetry',
    category: 'observability',
    type: 'Standard',
    synonyms: ['OTel']
  },
  {
    id: 'fluent-bit',
    name: 'Fluent Bit',
    category: 'observability',
    type: 'Tool',
    tags: ['logs']
  },
  {
    id: 'aws-xray',
    name: 'AWS X-Ray',
    category: 'observability',
    type: 'Service',
    synonyms: ['X-Ray']
  },
  {
    id: 'operational-dashboards',
    name: 'Operational Dashboards',
    category: 'observability',
    type: 'Practice'
  },
  {
    id: 'security-dashboards',
    name: 'Security Dashboards',
    category: 'observability',
    type: 'Practice'
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'collaboration',
    type: 'Tool'
  },
  {
    id: 'confluence',
    name: 'Confluence',
    category: 'collaboration',
    type: 'Tool'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'collaboration',
    type: 'Tool'
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    category: 'collaboration',
    type: 'Tool'
  },
  {
    id: 'coder',
    name: 'Coder',
    category: 'ide',
    type: 'Tool'
  },
  {
    id: 'vs-code',
    name: 'Visual Studio Code',
    category: 'ide',
    type: 'Tool',
    synonyms: ['VS Code']
  },
  {
    id: 'cloud9',
    name: 'AWS Cloud9',
    category: 'ide',
    type: 'Tool'
  }
]

export const items = rawItems.map((item) => ({
  ...item,
  description: descriptionById[item.id],
  tags: buildTags(item)
}))
