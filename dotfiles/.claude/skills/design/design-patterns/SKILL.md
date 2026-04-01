---
name: design-patterns
description: Recommends and applies design patterns from the Refactoring.Guru catalog for refactoring and new design. Use when refactoring code, designing new implementations, or when the user asks about factory method, strategy, builder, adapter, observer, or other GoF patterns.
---

# Design Patterns Expert

Recommends the most suitable design pattern for a problem and guides refactoring or new implementation using the [Refactoring.Guru design patterns catalog](https://refactoring.guru/design-patterns/catalog).

## Workflow

1. **Clarify the problem**  
   Identify: object creation vs structure vs behavior, variation points, and what might change.

2. **Choose a pattern**  
   Use the catalog in [reference.md](reference.md). Prefer the smallest pattern that fits; avoid over-engineering.

3. **Apply**  
   Introduce the pattern incrementally when refactoring. When designing from scratch, keep interfaces narrow and dependencies explicit.

4. **Cite**  
   When recommending a pattern, name it and link to Refactoring.Guru (e.g. https://refactoring.guru/design-patterns/strategy) so the user can read the full explanation and examples.

## When to Use Which Family

| If the problem is… | Prefer patterns from… |
|--------------------|------------------------|
| How/when to create objects, or creation is complex | **Creational** (Factory Method, Abstract Factory, Builder, Prototype, Singleton) |
| How to compose or connect types, or integrate incompatible interfaces | **Structural** (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy) |
| How to assign responsibilities or vary behavior/algorithms | **Behavioral** (Strategy, State, Observer, Command, Template Method, etc.) |

## Quick decision cues

- **Multiple algorithms or behaviors, switch on type** → Strategy (or State if behavior is stateful).
- **Complex object with many optional parts** → Builder.
- **Creating families of related objects** → Abstract Factory.
- **Deferring creation to subclasses** → Factory Method.
- **Adding behavior without subclassing** → Decorator.
- **One-to-many notifications** → Observer.
- **Encapsulating requests as objects** → Command.
- **Reusing existing class with a different interface** → Adapter.
- **Simplifying a subsystem** → Facade.
- **Lazy or controlled access to an object** → Proxy.

## Refactoring vs new design

- **Refactoring**: Introduce one pattern at a time; keep behavior unchanged; add tests first when possible.
- **New design**: Start from the problem (creation/structure/behavior); name the pattern you’re using and keep the solution aligned with that pattern’s intent.

## Additional resources

- Full catalog and “when to use”: [reference.md](reference.md)
- Official catalog, diagrams, and code examples: [Refactoring.Guru – Design Patterns](https://refactoring.guru/design-patterns/catalog)
