# Testing Strategy (Phase 3.5)

## Overview

This document outlines the testing strategy for the SubtleForms plugin. The goal is to establish a baseline of stability, prevent regressions, and ensure critical user flows remain functional across updates. We prioritize confidence and realism over 100% code coverage.

## 1. What We Test

### Backend Integrity (PHP)

- **Form Persistence**: Creating, saving, and retrieving forms and schemas.
- **Submission Handling**: capturing data, validating payloads, and database writes.
- **Status Logic**: Draft vs. Published states and their effects on visibility.
- **Safeguards**: Autosave validation (preventing empty forms) and deprecation handling.

### Frontend Logic (JavaScript)

- **State Management**: Schema normalization/denormalization.
- **Autosave Logic**: Debouncing and dirty/clean state transitions.
- **Gating**: Publish/Draft logic in the UI.

### Critical User Journeys (E2E)

- **Form Lifecycle**: Create -> Edit -> Publish -> View.
- **Builder Stability**: Adding fields, navigating away, handling unsaved changes.
- **Submission Flow**: Frontend rendering -> User input -> Submission -> Admin verification.
- **Data Review**: Admin submission detail view rendering.

### System Stability (Stress)

- **Load Handling**: Behavior under rapid, sequential submission load (100-500 submissions).
- **Performance**: Response times and failure rates.

## 2. What We Do NOT Test (Yet)

- **WordPress Core Behavior**: We assume WP functions work as documented.
- **UI/CSS Rendering**: Pixel-perfect layout checks (unless critical for usability).
- **Drag & Drop Mechanics**: Complex interaction testing is brittle; we test the _result_ of the action (schema change).
- **External Integrations**: Email delivery, third-party webhooks (mocked where necessary).

## 3. Tooling & Rationale

### PHPUnit (Backend)

- **Why**: The standard for WordPress plugin testing.
- **Usage**: Unit tests for PHP classes, integration tests for database interactions.

### Jest (Frontend Unit)

- **Why**: Standard for React applications. Fast and reliable for logic testing.
- **Usage**: Testing utility functions, hooks, and state logic in isolation.

### Playwright (E2E)

- **Why**: Modern, reliable, and capable of handling complex scenarios (multiple tabs, network interception).
- **Usage**: Simulating real user behavior in a browser environment.

### Custom Scripts (Stress)

- **Why**: Need specific control over submission rates and payload types without overhead of full browser automation.
- **Usage**: PHP/Shell scripts to curl endpoints.

## 4. How to Run Tests

### Prerequisites

- Node.js (v20+)
- Composer
- Local WordPress environment

### Commands

- **PHP Tests**: `npm run test:php` (Runs PHPUnit)
- **JS Tests**: `npm run test:js` (Runs Jest)
- **E2E Tests**: `npm run test:e2e` (Runs Playwright)
- **Stress Test**: `npm run test:stress` (Runs custom load script)
- **All Tests**: `npm run test` (Runs all suites)

## 5. Continuous Integration (Future)

- Tests should run on every PR.
- Main branch must always pass all tests.
