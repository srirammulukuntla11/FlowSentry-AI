# FlowSentry AI --- Software Requirements Specification

**Project:** FlowSentry AI\
**Hackathon:** VORTEX 2K26 --- Global AI Innovation Hackathon\
**Version:** 1.0 (MVP scope)\
**Status:** Initial specification

## 1. Project overview

FlowSentry AI is a web application that statically inspects exported n8n
workflow JSON files and helps users understand potential security risks.
It combines deterministic security rules with AI-generated explanations
and a visual workflow graph.

**Core promise:** Inspect an automation workflow before trusting it.

FlowSentry AI does **not** execute uploaded workflows, access the user's
n8n instance automatically, or guarantee that a workflow is secure.
Findings are potential risks that require human review.

## 2. Problem statement

Automation workflows connect forms, APIs, AI services, databases, email
systems, and other tools. A workflow can be functional while still
containing risky configurations, such as suspicious external
destinations, exposed secret-like strings, or unnecessary data sharing.
Manually reviewing a large workflow can be difficult.

FlowSentry AI helps developers inspect a workflow export, identify
evidence-backed warning patterns, understand why they matter, and see
where the relevant nodes appear in the workflow.

## 3. Goals

1.  Accept a user-uploaded n8n workflow JSON export.
2.  Validate the file and safely parse the workflow structure.
3.  Run deterministic checks for a defined set of security patterns.
4.  Show workflow nodes and connections in a visual graph.
5.  Use Gemini through n8n to explain findings based on sanitized
    evidence.
6.  Present severity, evidence, limitations, and recommended
    mitigations.
7.  Optionally save scan reports to MongoDB Atlas.
8.  Deploy a working public demo and publish source code for hackathon
    evaluation.

## 4. Non-goals for the MVP

-   Executing uploaded workflows.
-   Connecting to or modifying a user's live n8n instance.
-   Claiming to detect every security issue.
-   Automatically changing or repairing workflows.
-   Full enterprise policy management, team accounts, billing, or RBAC.
-   Guaranteed detection of data lineage where node semantics are
    unknown.
-   Sending raw workflow exports, credentials, or secret values to an AI
    model.

## 5. Target users

-   Developers building n8n automations.
-   Students and hackathon teams using automation tools.
-   Small teams that want a quick first-pass review before sharing or
    deploying a workflow.

## 6. MVP user journey

1.  User opens the FlowSentry AI web application.
2.  User selects an exported `.json` n8n workflow file.
3.  The application validates file type, file size, JSON syntax, and
    basic workflow structure.
4.  The backend parses nodes and connections without executing them.
5.  A rule engine scans the workflow and creates structured findings
    with evidence.
6.  The frontend displays the workflow graph and highlights nodes
    associated with findings.
7.  The backend sends only sanitized finding metadata and relevant
    redacted context to an n8n webhook.
8.  The n8n workflow calls Gemini to explain the findings and suggest
    mitigations.
9.  The application displays the report and, if database configuration
    is enabled, stores the scan summary.

## 7. Functional requirements

### FR-01: Workflow upload

-   Accept `.json` files only.
-   Enforce a configurable size limit (initial default: 2 MB).
-   Reject malformed JSON and unsupported structures with a clear
    message.
-   Never execute the uploaded workflow.

### FR-02: Workflow parsing

-   Extract workflow name, nodes, node IDs, node types, positions when
    available, and connections.
-   Handle missing optional fields without crashing.
-   Do not assume every node type or expression can be fully
    interpreted.

### FR-03: Deterministic security checks

The initial rule set should include: - **Secret-like value check:**
detect likely API keys, tokens, passwords, or private-key patterns in
exported parameters. Redact the matched value in all output and logs. -
**External destination review:** identify HTTP/request nodes that send
data to external destinations. Flag for review based on destination and
context; do not label a URL malicious without reliable evidence. -
**Unclear or risky data transfer:** flag selected patterns where data
appears to move from a sensitive-input node to an external request node,
when the graph and expressions provide sufficient evidence. -
**Credential configuration review:** highlight nodes with credential
references or authentication configuration for manual review, while
recognizing that n8n exports commonly do not contain the actual
credential secret. - **High-privilege or destructive action review:**
flag selected node/action patterns for review when the node type and
parameters make this possible. - **Unknown node or unsupported
expression:** show an informational coverage warning when the scanner
cannot confidently interpret a relevant part of the workflow.

Each finding must contain a rule ID, title, severity, affected node IDs,
evidence summary, confidence/limitations, and a recommended mitigation.
Rules should avoid false claims; use "potential risk" or "review
recommended" when evidence is incomplete.

### FR-04: Workflow graph

-   Render nodes and directed connections using a React graph library
    such as `@xyflow/react`.
-   Allow selecting a finding to highlight its affected node(s).
-   Display a clear legend for node and finding severity.
-   Keep the graph usable on a laptop-sized screen.

### FR-05: AI explanation

-   Use an n8n webhook workflow to orchestrate Gemini analysis.
-   Send sanitized finding metadata only; do not send raw uploaded
    workflow JSON or secret values by default.
-   Require the model to explain only the supplied evidence, state
    uncertainty, and avoid inventing vulnerabilities.
-   Validate the AI response against a schema before displaying it.
-   If n8n/Gemini is unavailable, show deterministic findings and a
    clear AI-unavailable message.

### FR-06: Report

Display: - Overall summary and finding counts by severity. - Individual
findings with affected node, evidence, explanation, and mitigation. -
Scan limitations and a reminder that results are not a security
certification. - Export or copy report summary if time permits.

### FR-07: Scan history

-   If MongoDB is configured, save scan timestamp, workflow name,
    summary, findings, and AI explanations.
-   Do not save raw workflow files or secrets by default.
-   Provide a graceful mode if database configuration is unavailable.

### FR-08: Error handling

-   Return actionable errors for invalid JSON, oversized files, missing
    n8n configuration, AI timeouts, and database failures.
-   Never expose API keys, stack traces, or sensitive request details to
    the browser.

## 8. Non-functional requirements

-   **Security:** never execute uploaded workflows; validate inputs;
    redact secrets; keep API keys in environment variables or managed
    credentials.
-   **Privacy:** minimize data sent to external services; explain what
    is sent to n8n/Gemini.
-   **Reliability:** deterministic analysis must work even if AI
    services are unavailable.
-   **Usability:** findings must be understandable to a student
    developer without security expertise.
-   **Performance:** target a scan under 10 seconds for a typical small
    workflow, excluding slow external AI responses.
-   **Maintainability:** keep parsing, rules, AI orchestration,
    persistence, and UI in separate modules.
-   **Transparency:** show evidence and limitations for every finding.

## 9. Suggested severity model

-   **High:** strong evidence of a secret-like value or a clearly
    dangerous configuration. Do not use High for merely unfamiliar
    domains.
-   **Medium:** potentially risky data transfer or sensitive
    configuration requiring context.
-   **Low:** hardening suggestion or weak signal.
-   **Info:** coverage warning, unknown node, or informational
    observation.

Severity must come from explicit rule logic. AI may explain a severity
but must not silently change it.

## 10. Acceptance criteria

The MVP is acceptable when: 1. A valid n8n JSON export can be uploaded
and parsed. 2. Invalid JSON and oversized files are rejected safely. 3.
At least four deterministic checks produce structured findings on sample
workflows. 4. Secret-like values are redacted from findings, logs, AI
requests, and stored reports. 5. The graph renders nodes and connections
and highlights nodes for a selected finding. 6. Sanitized findings reach
the n8n webhook and receive a validated AI explanation, or the app
degrades gracefully when AI is unavailable. 7. A report is visible and
scan history works when MongoDB is configured. 8. The deployed demo,
GitHub repository, and README are accessible to judges.

## 11. Demo plan

Prepare two synthetic workflow exports: - **Safe-ish sample:** simple
form-to-approved-service workflow with no embedded secrets. - **Risky
sample:** contains a fake placeholder secret and a data transfer to an
unfamiliar test endpoint.

Never use real credentials or real personal data in demo samples.
Explain that the sample illustrates detection behavior and does not
prove a destination is malicious.

## 12. Risks and mitigations

-   **False positives:** show evidence and confidence/limitations; keep
    severity conservative.
-   **AI hallucinations:** ask Gemini to use supplied evidence only and
    validate output.
-   **Sensitive uploads:** never execute files; redact secrets; send
    sanitized metadata only.
-   **n8n trial/availability:** keep the deterministic scanner usable
    without n8n; prepare a local/mock response for development and demo
    fallback.
-   **Deadline pressure:** prioritize upload, parser, deterministic
    rules, findings UI, and demo before optional features.
