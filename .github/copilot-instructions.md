# Copilot Instructions

This repository is a JavaScript/TypeScript library/application. When generating or suggesting code, reinforce and follow
the principles and objectives outlined below:

## Core Development Guidance

### 1. Efficiency and Performance

- Prefer fast, efficient code with minimal runtime overhead.
- Avoid unnecessary iterations, blocking operations, and patterns that cause memory leaks.
- Use appropriate data structures (Map/Set over Object/Array when beneficial for lookups).
- Prefer async/await patterns; avoid callback hell and unnecessary synchronous operations.
- Be mindful of bundle size—prefer tree-shakeable imports and lightweight dependencies.
- Use memoization or caching for expensive computations when appropriate.
- Avoid unnecessary re-renders in UI frameworks (React, Vue, etc.).

### 2. JavaScript/TypeScript Best Practices

- Use modern ES6+ syntax (const/let over var, arrow functions, destructuring, template literals).
- Provide TypeScript types or JSDoc annotations for all public APIs and complex functions.
- Prefer named exports over default exports for better tree-shaking and refactoring.
- Use dependency injection or module patterns; avoid hard-coded dependencies.
- Validate inputs at module boundaries using schema validation (Zod, Yup, Joi) for complex cases.
- Follow consistent module organization (barrel files, feature-based folders).
- Prefer pure functions and immutable data patterns where practical.
- Use Promises or async/await consistently—never mix callbacks and promises.
- Handle all Promise rejections and async errors appropriately.

### 3. SRP & DRY Principles

- Avoid code duplication (DRY). Extract repeated logic into reusable functions or modules.
- Follow the Single Responsibility Principle (SRP):
    - Entry points/handlers should be thin, delegating business logic to services or utilities.
    - Modules/classes should handle one logical concern (not mixing unrelated tasks).
- Prefer composition over inheritance for code reuse.
- Extract complex conditionals into well-named functions or constants.

### 4. Readability and Maintainability

- Use clear, descriptive names for variables, functions, and classes.
- Add JSDoc comments for all exported functions, classes, and methods.
- Prefer "self-documenting" code over excessive inline comments.
- Use TypeScript enums, union types, or constant objects (`as const`) for role/status/value domains.
- Group related functionality into logical folders (e.g., `/utils`, `/services`, `/types`, `/hooks`).
- Keep functions short and focused (~30-40 lines maximum); extract when necessary.
- Prefer early returns to reduce nesting depth.
- Use meaningful error messages that aid debugging.

### 5. Security

- Validate and sanitize all external input (user input, API responses, URL params).
- Guard against XSS—escape HTML, avoid `innerHTML`, use safe templating.
- Prevent prototype pollution—avoid `Object.assign` with untrusted data; use structured cloning.
- Never include secrets, API keys, or credentials in code; use environment variables.
- Avoid `eval()`, `Function()` constructor, and dynamic code execution with user input.
- For Node.js: guard against path traversal, command injection, and ReDoS vulnerabilities.
- Never log sensitive data or expose it in error messages.
- Use Content Security Policy (CSP) headers for browser applications.

### 6. Error Handling

- Wrap all async operations in proper error handling (try/catch, `.catch()`).
- Provide meaningful, actionable error messages.
- Use custom error classes for domain-specific errors.
- Never swallow errors silently—log or propagate appropriately.
- Implement graceful degradation where appropriate.

## Formatting and Style

- Follow the project's ESLint and Prettier configurations.
- Respect `.editorconfig`, `.eslintrc`, and `.prettierrc` settings.
- Use consistent import ordering: built-ins → external packages → internal modules → relative imports.
- Add JSDoc comments for all public API exports and shared utilities.

## Testing

- Generate unit tests for utilities, services, and business logic when requested.
- Cover edge cases and error scenarios in tests.
- Use appropriate mocking for external dependencies.
- Follow the project's existing test patterns and conventions.

---

**When generating code, always prioritize clarity, maintainability, type safety, and secure best practices.**