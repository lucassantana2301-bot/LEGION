# LEGION // Product Vision & Specifications

## Product Definition
**LEGION** is an autonomous software engineering SaaS platform powered by a coordinated network of AI agents (**Commander**, **Architect**, **Builder**, **Sentinel**).

## Positioning
Users do not ask an AI for disconnected code snippets; users delegate high-level **engineering missions** to an AI software engineering organization.

## Key Workflows
1. **Mission Ingestion**: The user inputs a mission (e.g. *"Build a financial SaaS with auth, PostgreSQL, dashboard, API and tests"*).
2. **Commander Brief & Planning**: The Commander agent synthesizes requirements and compiles an execution graph.
3. **Architect System Design**: The Architect designs schemas and technical contracts.
4. **Builder Implementation**: The Builder produces verified source files and endpoints.
5. **Sentinel Validation & Failure Loop**: The Sentinel tests each deliverable. When issues arise (e.g. `ISSUE-004`), Sentinel halts progress, assigns hotfixes to Builder, and verifies resolution via retests.
6. **Release & Production Verification**: Commander verifies full build pass before completing the mission.
