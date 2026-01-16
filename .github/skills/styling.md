# SubtleForms Styling Skills

## CSS Architecture: BEM + Utility Prohibition

SubtleForms uses strict BEM (Block Element Modifier) methodology with **ZERO utility classes**.

## Core Principles

### 1. BEM Naming Convention

```scss
// Block
.sf-form-builder { }

// Element (double underscore)
.sf-form-builder__canvas { }

// Modifier (double dash)
.sf-form-builder--fullscreen { }

// Element with modifier
.sf-form-builder__canvas--dragging { }
```

### 2. No Utility Classes

❌ **FORBIDDEN:**
```jsx
<div className="flex justify-between items-center p-4 bg-gray-100">
```

✅ **CORRECT:**
```jsx
<div className="sf-toolbar">
```

```scss
.sf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f9fafb;
}
```

### 3. CSS Custom Properties for Theming

```scss
:root {
  --sf-primary: #2563eb;
  --sf-danger: #dc2626;
  --sf-border: #e5e7eb;
  --sf-text-primary: #1f2937;
  --sf-text-secondary: #6b7280;
  --sf-text-tertiary: #9ca3af;
}
```

Use variables consistently:
```scss
.sf-button {
  background-color: var(--sf-primary);
  color: white;
  border: 1px solid var(--sf-primary);
}
```

## File Organization

### Component-Scoped SCSS
Each React component has its own `.scss` file:

```
components/
├── FormBuilder.jsx
├── FormBuilder.scss
├── FieldInspector.jsx
├── FieldInspector.scss
```

### Import Pattern
```jsx
import './FormBuilder.scss';

export default function FormBuilder() {
  return <div className="sf-form-builder">...</div>;
}
```

## Nesting Rules

### Maximum 3 Levels Deep
❌ **Too Deep:**
```scss
.sf-form-builder {
  &__canvas {
    &__field {
      &__label {
        &__icon { } // Too nested!
      }
    }
  }
}
```

✅ **Correct:**
```scss
.sf-form-builder__canvas { }
.sf-canvas-field { }
.sf-canvas-field__label { }
.sf-canvas-field-icon { }
```

### Flatten When Possible
Instead of deep nesting, create new blocks:

```scss
// ❌ Don't do this
.sf-form-builder {
  &__canvas {
    &__dropzone {
      &__placeholder { }
    }
  }
}

// ✅ Do this
.sf-canvas-dropzone { }
.sf-canvas-dropzone__placeholder { }
```

## Responsive Design

### Mobile-First Approach
```scss
.sf-form-builder {
  display: block; // Mobile default

  @media (min-width: 768px) {
    display: flex; // Tablet+
  }

  @media (min-width: 1024px) {
    max-width: 1200px; // Desktop
  }
}
```

### Breakpoint Variables
```scss
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-wide: 1280px;
```

## Spacing System

### Consistent Scale (0.25rem increments)
```scss
// ❌ Don't use arbitrary values
padding: 13px;

// ✅ Use scale
padding: 0.75rem;  // 12px
padding: 1rem;     // 16px
padding: 1.5rem;   // 24px
padding: 2rem;     // 32px
```

## Color Guidelines

### Semantic Color Names
❌ **Don't:**
```scss
background-color: #3b82f6;
```

✅ **Do:**
```scss
background-color: var(--sf-primary);
```

### State Colors
```scss
:root {
  --sf-success: #10b981;
  --sf-warning: #f59e0b;
  --sf-danger: #dc2626;
  --sf-info: #3b82f6;
}
```

## Typography

### Font Hierarchy
```scss
.sf-heading-1 {
  font-size: 1.875rem; // 30px
  font-weight: 700;
  line-height: 1.2;
}

.sf-heading-2 {
  font-size: 1.5rem; // 24px
  font-weight: 600;
  line-height: 1.3;
}

.sf-body {
  font-size: 0.875rem; // 14px
  line-height: 1.5;
}

.sf-caption {
  font-size: 0.75rem; // 12px
  line-height: 1.4;
}
```

## Component Patterns

### Button Component
```scss
.sf-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;

  &--primary {
    background-color: var(--sf-primary);
    color: white;

    &:hover {
      background-color: #1d4ed8;
    }
  }

  &--secondary {
    background-color: white;
    color: var(--sf-text-primary);
    border-color: var(--sf-border);

    &:hover {
      background-color: #f9fafb;
    }
  }

  &--danger {
    background-color: var(--sf-danger);
    color: white;

    &:hover {
      background-color: #b91c1c;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Card Component
```scss
.sf-card {
  background-color: white;
  border: 1px solid var(--sf-border);
  border-radius: 0.5rem;
  padding: 1.5rem;

  &__header {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--sf-border);
  }

  &__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sf-text-primary);
  }

  &__body {
    color: var(--sf-text-secondary);
  }

  &--elevated {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
}
```

## Animation Guidelines

### Micro-Interactions
```scss
.sf-button {
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}
```

### Loading States
```scss
@keyframes sf-spin {
  to { transform: rotate(360deg); }
}

.sf-spinner {
  animation: sf-spin 1s linear infinite;
}
```

## Accessibility

### Focus States
```scss
.sf-button {
  &:focus {
    outline: 2px solid var(--sf-primary);
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }
}
```

### High Contrast Mode
```scss
@media (prefers-contrast: high) {
  .sf-button {
    border-width: 2px;
  }
}
```

## Common Pitfalls

❌ **Don't use inline styles**
```jsx
<div style={{ padding: '16px' }}>
```

✅ **Use BEM classes**
```jsx
<div className="sf-container">
```

❌ **Don't use !important**
```scss
color: red !important;
```

✅ **Increase specificity properly**
```scss
.sf-form-builder__canvas .sf-field {
  color: red;
}
```

❌ **Don't hardcode colors**
```scss
background: #3b82f6;
```

✅ **Use CSS variables**
```scss
background: var(--sf-primary);
```

## Linting

### SCSS Lint Rules
- No utility classes (enforced)
- BEM naming convention (enforced)
- Maximum nesting depth: 3
- No !important
- Use CSS variables for colors

### Pre-commit Hook
```bash
npm run lint:scss
```

## Migration Guide

### Converting Utility Classes to BEM

Before:
```jsx
<div className="flex items-center gap-4 p-4 bg-white border rounded">
  <span className="text-sm font-medium">Label</span>
</div>
```

After:
```jsx
<div className="sf-field-label">
  <span className="sf-field-label__text">Label</span>
</div>
```

```scss
.sf-field-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: white;
  border: 1px solid var(--sf-border);
  border-radius: 0.25rem;

  &__text {
    font-size: 0.875rem;
    font-weight: 500;
  }
}
```
