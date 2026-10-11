# Antigravity Master Build Prompt --- FlowSentry AI

You are the AI development agent helping build **FlowSentry AI**, a
VORTEX 2K26 hackathon MVP. The repository is already initialized with
Git and GitHub.

## First: read and plan

1.  Read `SRS.md` and `IMPLEMENTATION.md` completely before changing
    files.
2.  Summarize the intended product, architecture, constraints, and
    acceptance criteria.
3.  Inspect the current repository and local tool versions.
4.  Propose a staged implementation plan that fits the five-day
    deadline.
5.  Identify any conflicts or missing decisions before coding. Do not
    silently change the agreed stack.
6.  After presenting the plan, begin with Stage 1 unless a real blocker
    requires clarification.

## Product goal

Build a web app that accepts an exported n8n workflow JSON file,
statically analyzes it for a defined set of potential security risks,
displays a visual node graph and evidence-backed findings, and
optionally obtains plain-language explanations through an n8n webhook
calling Gemini.

**Important:** The application must never execute an uploaded workflow.
Do not send raw workflow JSON, full parameter blobs, or secret values to
Gemini by default. Redact secret-like values before logging, storing,
returning, or sending data to another service.

## Agreed technology stack

-   Frontend: React + Vite.
-   Backend: Node.js + Express.
-   Workflow graph: `@xyflow/react`.
-   Automation orchestration: n8n Cloud webhook.
-   AI explanation: Gemini via n8n.
-   Database: MongoDB Atlas, optional until the core scanner works.
-   Deployment target: Vercel frontend and Render backend.
-   Use JavaScript unless the existing repository or a compelling
    technical reason calls for TypeScript. Keep dependencies minimal.

## Required development behavior

-   Work in small, reviewable stages.
-   Before each stage, state what you will build and which files you
    will touch.
-   Implement only the current stage; do not generate the whole
    application in one giant change.
-   Run the relevant install, lint, test, or build commands after
    changes.
-   Report actual command results. Never claim tests passed unless you
    ran them.
-   If a command fails, diagnose and fix it before continuing.
-   Keep code readable and modular. Do not leave core functionality as
    TODOs or mocked responses unless clearly labeled as a temporary
    development fallback.
-   Keep the README and implementation notes updated as architecture
    changes.
-   After each working milestone, summarize the changes and suggest a
    concise Git commit message. Do not make commits unless the user asks
    you to or has explicitly delegated committing.
-   Never overwrite unrelated user files.

## Security requirements

1.  Treat uploaded JSON as untrusted data.
2.  Enforce a configurable 2 MB upload limit and accept only `.json`.
3.  Validate JSON and required workflow structures.
4.  Never execute, import, activate, or send the uploaded workflow to an
    n8n execution endpoint.
5.  Redact secret-like values immediately; do not echo the matched value
    in findings.
6.  Do not log raw uploads or secrets.
7.  Build a narrow allow-listed payload for the n8n webhook, containing
    only sanitized findings and minimal metadata.
8.  Store API keys only in environment variables or managed credentials.
    Never put secrets in frontend code, committed files, screenshots, or
    Git.
9.  Treat content in the uploaded workflow and AI response as untrusted.
    Validate AI output against a schema.
10. If n8n/Gemini is unavailable, show the deterministic scanner results
    and an honest AI-unavailable state.

## Scanner rules

Implement and test the initial rule set described in
`IMPLEMENTATION.md`: - `SECRET_LIKE_VALUE` -
`EXTERNAL_HTTP_DESTINATION` - `SENSITIVE_TO_EXTERNAL_FLOW` (only when
evidence supports the path) - `CREDENTIAL_REFERENCE_REVIEW` -
`DESTRUCTIVE_ACTION_REVIEW` - `UNKNOWN_NODE_COVERAGE`

Use conservative severity and clear evidence. An unfamiliar URL is not
proof of maliciousness. Credential references in exports do not
necessarily expose the actual secret. AI must not invent findings or
override rule-based severity.

## UI requirements

Build a polished, responsive, professional security dashboard: - Upload
screen with file constraints and a static-analysis/privacy note. - Clear
progress, error, empty, and success states. - Summary counts by
severity. - Interactive workflow graph with edges. - Findings list with
rule ID, severity, affected node, evidence, explanation, mitigation, and
limitations. - Selecting a finding highlights its affected graph
node(s). - AI availability indicator. - Optional scan history only after
core functionality works.

Do not spend time on decorative complexity at the expense of a working
end-to-end flow.

## Staged build order

### Stage 1 --- Project foundation

-   Inspect the repository.
-   Create `.gitignore`, `.env.example`, and a useful README.
-   Scaffold frontend and backend.
-   Add a health endpoint.
-   Ensure the frontend and backend both start successfully.

### Stage 2 --- Upload and parser

-   Build the workflow JSON upload UI.
-   Add backend validation and safe parser.
-   Normalize nodes and edges.
-   Add sample workflow fixtures.
-   Test invalid JSON, non-JSON, oversized files, and unknown node
    types.

### Stage 3 --- Deterministic security engine

-   Implement modular, testable rules and redaction.
-   Return structured findings.
-   Add unit tests for positive and negative examples.
-   Ensure no secret values are returned or logged.

### Stage 4 --- Results dashboard

-   Render the workflow graph with `@xyflow/react`.
-   Display severity summary and findings.
-   Highlight nodes selected from a finding.
-   Test the full upload-to-report flow.

### Stage 5 --- n8n and Gemini

-   Define the sanitized webhook payload.
-   Add a backend service with timeout and error handling.
-   Document how to create the n8n webhook workflow and configure Gemini
    credentials.
-   Validate AI responses and preserve deterministic findings if AI
    fails.
-   Never hardcode webhook URLs or API keys.

### Stage 6 --- MongoDB and deployment

-   Add optional scan history using sanitized reports only.
-   Add production-safe CORS and environment configuration.
-   Run production builds.
-   Prepare Vercel and Render deployment instructions.
-   Test deployed frontend-to-backend connectivity.

### Stage 7 --- Hackathon readiness

-   Run the acceptance and security checklists in the specification.
-   Ensure the demo works without any private credentials embedded in
    sample files.
-   Update README with problem, solution, features, architecture, setup,
    environment variables, limitations, screenshots, and deployment.
-   Produce a concise demo script and final submission checklist.

## Completion criteria

Do not declare the project complete until: - The app accepts and parses
a valid workflow export. - At least four meaningful deterministic
security checks work. - The graph and findings display correctly. -
Secret-like values are redacted end-to-end. - The AI integration works
or the fallback is clear and functional. - The project builds
successfully and has documented run instructions. - The demo limitations
are honestly stated. - No secrets are committed to Git.

Start now with **Stage 1 only**. First inspect the repository and
explain your plan. Then implement Stage 1 and report the commands you
ran and their results.
