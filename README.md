<a href="https://hgg-profiling.com">
  <img alt="RoboRail Assistant - AI-powered support for HGG Profiling Equipment" src="app/(chat)/opengraph-image.png">
  <h1 align="center">RoboRail Assistant</h1>
</a>

<p align="center">
    RoboRail Assistant is an AI-powered support system for the RoboRail machine manufactured by HGG Profiling Equipment b.v., providing expert guidance on operation, maintenance, troubleshooting, and safety protocols.
</p>

<p align="center">
  <a href="#roborail-features"><strong>RoboRail Features</strong></a> ·
  <a href="#safety-protocols"><strong>Safety Protocols</strong></a> ·
  <a href="#troubleshooting-workflows"><strong>Troubleshooting</strong></a> ·
  <a href="#technical-setup"><strong>Technical Setup</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## RoboRail Features

### 🤖 AI-Powered RoboRail Expertise
- **Specialized Knowledge Base**: Comprehensive understanding of RoboRail machine operations, maintenance, and troubleshooting
- **Safety-First Approach**: Prioritizes user safety with hazard identification and proper protocol guidance
- **Concise Expert Responses**: Provides brief, accurate answers with option for detailed explanations
- **Systematic Troubleshooting**: Guided diagnostic workflows for efficient problem resolution

### 🔧 Technical Capabilities
- **Real-time Assistance**: Instant access to RoboRail operational guidance
- **Step-by-Step Instructions**: Clear procedures for maintenance, calibrations, and operations
- **Error Diagnosis**: Systematic approach to identifying and resolving machine issues
- **Code Formatting**: Proper formatting for machine commands and technical procedures

### 🛡️ Safety & Support Integration
- **Safety Protocol Emphasis**: Highlights potential hazards and proper safety measures
- **HGG Customer Support**: Direct escalation path for complex issues beyond AI scope
- **Documentation Integration**: Access to RoboRail manual and technical documentation
- **Progressive Disclosure**: Brief responses first, detailed information on request

### 💻 Technical Infrastructure
- [Next.js](https://nextjs.org) App Router with React Server Components
- [AI SDK](https://sdk.vercel.ai/docs) with OpenAI o4-mini reasoning model
- ContentPort-inspired smooth animations and auto-scrolling chat interface
- Vector store integration for RoboRail documentation search
- Real-time streaming responses with typewriter effects

## AI Model Configuration

The RoboRail Assistant uses **OpenAI o4-mini with medium reasoning effort** as the primary model, specifically optimized for:

- **Technical Problem Solving**: Enhanced reasoning for complex RoboRail diagnostics
- **Safety Analysis**: Thorough evaluation of operational procedures and hazards
- **Step-by-Step Guidance**: Logical breakdown of maintenance and operational tasks
- **Reasoning Transparency**: Displays thinking process for complex troubleshooting scenarios

Supported model providers:
- [OpenAI](https://openai.com) - Primary provider with reasoning models (o1, o3, o4 series)
- [Google Gemini](https://ai.google.dev) - Secondary provider for specialized tasks
- Seamless model switching via [AI SDK](https://sdk.vercel.ai/docs) configuration

## Safety Protocols

⚠️ **IMPORTANT SAFETY NOTICE** ⚠️

The RoboRail Assistant prioritizes safety in all interactions. Always follow these protocols:

### 🔐 Before Operating RoboRail:
1. **Read all safety documentation** provided by HGG Profiling Equipment
2. **Verify proper training** on RoboRail operation before use
3. **Check safety equipment** and emergency procedures
4. **Confirm machine status** and environmental conditions

### ⚡ During Operations:
- **Follow lockout/tagout procedures** for maintenance
- **Use appropriate PPE** as specified in HGG documentation
- **Monitor machine parameters** continuously during operation
- **Stop immediately** if any unusual sounds, vibrations, or behaviors occur

### 🚨 Emergency Procedures:
- **Emergency Stop**: Located at [position per HGG manual]
- **HGG Support Contact**: [Contact information to be added]
- **Report incidents** according to facility safety protocols

## Troubleshooting Workflows

The RoboRail Assistant provides systematic troubleshooting approaches:

### 📋 Diagnostic Process:
1. **Symptom Identification**: Describe observed issues
2. **Recent Changes**: Document any modifications or maintenance
3. **Error Messages**: Provide exact error codes or messages
4. **Operating Conditions**: Environmental and operational context
5. **Systematic Testing**: Guided step-by-step diagnostics

### 🔧 Common Issue Categories:
- **Mechanical Problems**: Alignment, wear, mechanical failures
- **Electrical Issues**: Power, control systems, sensors
- **Software/Control**: Programming, parameter settings
- **Calibration**: Accuracy, repeatability, measurement issues

## Technical Setup

## Setup and Configuration

### Environment Variables

This application requires several environment variables to function properly. Copy `.env.example` to `.env` and configure the following:

#### Required OpenAI Configuration
- `OPENAI_API_KEY` - Your OpenAI API key (starts with `sk-`)
- Models are configured following [OpenAI's model documentation](https://platform.openai.com/docs/models)

#### Optional AI Providers
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google Gemini models
- `COHERE_API_KEY` - For enhanced embedding capabilities

#### Database and Authentication
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth.js secret key
- `NEXTAUTH_URL` - Your application URL

#### Vector Store Configuration
- Configured for OpenAI vector store operations following [OpenAI Tools File Search](https://platform.openai.com/docs/guides/tools-file-search)
- Citations are automatically displayed in responses per [OpenAI PDF Files documentation](https://platform.openai.com/docs/guides/pdf-files?api-mode=responses)

### RoboRail AI Model Configuration

Optimized for RoboRail technical support with **o4-mini medium reasoning effort**:

#### 🧠 Reasoning Capabilities:
- **Technical Problem Analysis**: Step-by-step diagnostic reasoning
- **Safety Assessment**: Thorough evaluation of operational procedures
- **Maintenance Planning**: Logical sequencing of maintenance tasks
- **Troubleshooting Logic**: Systematic elimination of potential causes

#### 🔍 Transparency Features:
- **Reasoning Token Display**: Shows AI thinking process for complex issues
- **Decision Traceability**: Clear explanation of diagnostic conclusions
- **Safety Rationale**: Explicit reasoning for safety recommendations
- **Progressive Complexity**: Adapts reasoning depth to issue complexity

#### ⚙️ RoboRail-Specific Optimizations:
- **Machine-Specific Knowledge**: Trained on RoboRail operational patterns
- **Safety-First Processing**: Prioritizes safety considerations in all responses
- **Technical Precision**: Accurate technical terminology and procedures
- **HGG Integration**: Seamless escalation to HGG customer support

### RoboRail Documentation Integration

Automated access to RoboRail technical documentation:

#### 📚 Document Sources:
- **RoboRail Operations Manual**: Complete operational procedures
- **Maintenance Schedules**: Preventive and corrective maintenance
- **Safety Protocols**: HGG-approved safety procedures
- **Troubleshooting Guides**: Systematic diagnostic procedures
- **Technical Specifications**: Machine parameters and capabilities

#### 🔗 Citation Format:
- **Manual References**: `[RoboRail Manual, Section X.Y, Page Z]`
- **Safety Documents**: `[Safety Protocol: procedure_name.pdf]`
- **Technical Specs**: `[Tech Spec: parameter_document.pdf, Page X]`
- **Maintenance Guides**: `[Maintenance: task_guide.pdf, Step X]`

#### 🎯 Smart Document Retrieval:
- **Context-Aware Search**: Finds relevant documentation based on issue type
- **Safety-Priority Retrieval**: Prioritizes safety-related documentation
- **Version Control**: Always references latest approved documentation
- **Confidence Scoring**: Indicates relevance and reliability of retrieved information

## HGG Customer Support Integration

### 📞 When to Contact HGG Support:
- Issues beyond standard troubleshooting procedures
- Safety-critical problems requiring immediate attention
- Warranty or service-related questions
- Software updates or specialized modifications

### 🔗 HGG Contact Information:
**HGG Profiling Equipment b.v.**
- **Main Office**: +31 (0)73 599 6360
- **Website**: [https://hgg-profiling.com](https://hgg-profiling.com)
- **Technical Support**: support@hgg-profiling.com
- **Service Department**: service@hgg-profiling.com
- **Parts Department**: parts@hgg-profiling.com
- **Emergency Hotline**: [Available 24/7 for critical issues]
- **Address**: Laan van Ypenburg 100, 2497 GB The Hague, Netherlands

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

## Development

This project includes a robust development workflow with automated code quality checks:

### Available Scripts

- `pnpm lint` - Check code for linting issues (read-only)
- `pnpm lint:fix` - Fix auto-fixable linting issues
- `pnpm format` - Format code using Biome
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run all tests (E2E with Playwright)
- `pnpm test:unit` - Run unit tests only (Vitest)

### Git Hooks

The project uses [Husky](https://typicode.github.io/husky/) to enforce code quality:

#### Pre-commit Hook

- Automatically runs on `git commit`
- Uses [lint-staged](https://github.com/okonet/lint-staged) to format and lint staged files
- Formats code with Biome and fixes linting issues where possible

#### Pre-push Hook

- Automatically runs on `git push`
- Executes TypeScript type checking
- Runs linting checks
- Runs unit tests
- Provides warnings for issues but doesn't block pushes (configurable)

### Skip Hooks During Development

When needed, you can skip the git hooks:

```bash
# Skip pre-commit hook
git commit --no-verify -m "your message"

# Skip pre-push hook
git push --no-verify

# Skip pre-push hook with environment variable
SKIP_PREPUSH=true git push
```

### Code Quality

The project maintains high code quality through:

- **ESLint** with Next.js and accessibility rules
- **Biome** for fast formatting and additional linting
- **TypeScript** for type safety
- **Automated testing** with Playwright and Vitest
- **Pre-commit formatting** to ensure consistent code style
- **Pre-push validation** to catch issues before they reach the repository
