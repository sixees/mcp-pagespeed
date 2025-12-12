# Code Review Instructions

This repository is a JavaScript library/application. When reviewing code changes, reinforce and verify the following
principles and objectives:

## Core Review Guidance

### 1. Efficiency and Performance

- Prefer fast, efficient code with minimal runtime overhead.
- Flag and suggest improvements for unnecessary iterations, blocking operations, and memory leaks.
- Recommend appropriate data structures (Map/Set over Object/Array when beneficial).
- Prefer async/await patterns; avoid callback hell and unnecessary synchronous operations.
- Watch for bundle size impact—flag large dependencies or suggest tree-shakeable alternatives.
- Recommend memoization or caching for expensive computations.
- Avoid unnecessary re-renders in UI frameworks (React, Vue, etc.).

### 2. JavaScript/TypeScript Best Practices

- Enforce modern ES6+ syntax (const/let over var, arrow functions, destructuring, template literals).
- Encourage TypeScript or JSDoc type annotations for public APIs and complex functions.
- Prefer named exports over default exports for better tree-shaking and refactoring.
- Use dependency injection or module patterns over hard-coded dependencies.
- Validate inputs at module boundaries; prefer schema validation libraries (Zod, Yup, Joi) for complex validation.
- Follow consistent module organization (e.g., barrel files, feature-based folders).
- Prefer pure functions and immutable data patterns where practical.
- Use Promises or async/await consistently—avoid mixing callbacks and promises.

### 3. SRP & DRY Principles

- Avoid code duplication (DRY). Highlight or refactor repeated logic/functions.
- Follow the Single Responsibility Principle (SRP):
    - Entry points/handlers should be thin, delegating business logic to services or utilities.
    - Modules/classes should handle one logical concern (not mixing unrelated tasks).
- Prefer shared utility modules or composition over inheritance for code reuse.
- Extract complex conditionals into well-named functions or constants.

### 4. Readability and Maintainability

- Flag unclear variable, function, or class names; suggest concise and descriptive alternatives.
- Ensure all exported functions/classes/methods have JSDoc comments for public APIs.
- Prefer "self-documenting" code over excessive inline comments.
- Use TypeScript enums, union types, or constant objects for role/status/value domains.
- Encourage grouping related functionality (e.g., `/utils`, `/services`, `/types`, `/hooks`).
- Keep functions short and focused—suggest extraction if a function exceeds ~30-40 lines.
- Prefer early returns to reduce nesting depth.

### 5. Security

- Enforce strict validation and sanitization on all external input (user input, API responses, URL params).
- Guard against XSS (escape HTML, avoid `innerHTML`, use safe templating).
- Prevent prototype pollution—avoid `Object.assign` with untrusted data; prefer structured cloning.
- Never commit secrets, API keys, or credentials; use environment variables.
- Review third-party dependencies for known vulnerabilities (`npm audit`, Snyk, etc.).
- Avoid `eval()`, `Function()` constructor, and dynamic code execution with user input.
- For Node.js: guard against path traversal, command injection, and ReDoS vulnerabilities.
- Ensure sensitive data is never logged or exposed in error messages.
- Use Content Security Policy (CSP) headers for browser applications.

### 6. Error Handling

- Ensure all async operations have proper error handling (try/catch, `.catch()`).
- Provide meaningful error messages; avoid swallowing errors silently.
- Use custom error classes for domain-specific errors.
- Implement graceful degradation where appropriate.

## Formatting and Style

- Follow a consistent code style enforced by ESLint and Prettier.
- Configure and respect `.editorconfig`, `.eslintrc`, and `.prettierrc` settings.
- Use JSDoc comments for all public API exports and shared utilities.
- Prefer consistent import ordering (built-ins → external → internal → relative).

## Testing

- Encourage unit tests for utilities, services, and business logic.
- Flag untested edge cases or missing test coverage for critical paths.
- Prefer integration tests for complex workflows.
- Mock external dependencies appropriately.

---

**Always refer to this document during code review. If in doubt, err on the side of clarity, maintainability, and secure
best practice.**