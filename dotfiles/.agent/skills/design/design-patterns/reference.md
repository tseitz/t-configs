# Design Patterns Catalog (Refactoring.Guru)

Canonical source: [Refactoring.Guru – Design Patterns Catalog](https://refactoring.guru/design-patterns/catalog).  
Use this reference to pick the right pattern; use the site for structure, UML, and code examples.

---

## Creational

| Pattern | Intent | Use when |
|--------|--------|----------|
| **Factory Method** | Let subclasses decide which class to instantiate. | Creation logic should vary by subclass; you want to defer “which concrete class” to a factory method. |
| **Abstract Factory** | Create families of related objects without specifying concrete classes. | You need consistent sets of products (e.g. UI theme: buttons + panels + fonts). |
| **Builder** | Construct complex objects step by step; same construction code, different representations. | Object has many optional parts or construction is multi-step and should be readable. |
| **Prototype** | Clone objects instead of creating from scratch. | Copying existing instances is simpler or cheaper than full construction. |
| **Singleton** | One instance globally. | Exactly one instance is required (logging, config, connection pool). Prefer dependency injection where testability matters. |

---

## Structural

| Pattern | Intent | Use when |
|--------|--------|----------|
| **Adapter** | Make an existing interface work with another interface. | You need to use a class whose interface doesn’t match what callers expect. |
| **Bridge** | Split abstraction from implementation so both can vary independently. | You want to avoid a Cartesian explosion of subclasses (e.g. Shape × Renderer). |
| **Composite** | Compose objects into tree structures; treat individual and composite uniformly. | You have part–whole hierarchies and want the same interface for leaves and containers. |
| **Decorator** | Attach extra behavior to an object dynamically. | You want to add responsibilities without subclassing; wrapping is preferable to inheritance. |
| **Facade** | Single, simple interface to a subsystem. | You want to hide complexity or many interfaces behind one entry point. |
| **Flyweight** | Share state across many small objects to save memory. | Many objects share most of their state (e.g. characters in a document, tiles). |
| **Proxy** | Provide a surrogate that controls access to another object. | You need lazy init, access control, logging, or a remote/local boundary. |

---

## Behavioral

| Pattern | Intent | Use when |
|--------|--------|----------|
| **Chain of Responsibility** | Pass a request along a chain of handlers until one handles it. | Multiple objects can handle a request; you don’t want to hardwire the handler. |
| **Command** | Encapsulate a request as an object (action + parameters). | You need undo/redo, queuing, logging, or parameterizing operations. |
| **Iterator** | Traverse a collection without exposing its representation. | You want uniform traversal over different structures and to hide internals. |
| **Mediator** | Centralize complex interactions between objects. | Many objects talk to each other; you want to reduce coupling and clarify flow. |
| **Memento** | Capture and restore an object’s state without exposing internals. | You need snapshots for undo or checkpoints. |
| **Observer** | Notify dependents when state changes (one-to-many). | One object must notify many others without tight coupling. |
| **State** | Let an object change behavior when its internal state changes. | Behavior depends on state; you want to avoid large conditionals. |
| **Strategy** | Define a family of algorithms and make them interchangeable. | Multiple algorithms for the same task; you want to switch at runtime. |
| **Template Method** | Define a skeleton algorithm; subclasses fill in steps. | Overall algorithm is fixed; only some steps vary by subclass. |
| **Visitor** | Add new operations to object structure without changing classes. | You have a stable structure but many distinct operations over it. |

---

## Pattern links (Refactoring.Guru)

- Creational: [Factory Method](https://refactoring.guru/design-patterns/factory-method), [Abstract Factory](https://refactoring.guru/design-patterns/abstract-factory), [Builder](https://refactoring.guru/design-patterns/builder), [Prototype](https://refactoring.guru/design-patterns/prototype), [Singleton](https://refactoring.guru/design-patterns/singleton)
- Structural: [Adapter](https://refactoring.guru/design-patterns/adapter), [Bridge](https://refactoring.guru/design-patterns/bridge), [Composite](https://refactoring.guru/design-patterns/composite), [Decorator](https://refactoring.guru/design-patterns/decorator), [Facade](https://refactoring.guru/design-patterns/facade), [Flyweight](https://refactoring.guru/design-patterns/flyweight), [Proxy](https://refactoring.guru/design-patterns/proxy)
- Behavioral: [Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility), [Command](https://refactoring.guru/design-patterns/command), [Iterator](https://refactoring.guru/design-patterns/iterator), [Mediator](https://refactoring.guru/design-patterns/mediator), [Memento](https://refactoring.guru/design-patterns/memento), [Observer](https://refactoring.guru/design-patterns/observer), [State](https://refactoring.guru/design-patterns/state), [Strategy](https://refactoring.guru/design-patterns/strategy), [Template Method](https://refactoring.guru/design-patterns/template-method), [Visitor](https://refactoring.guru/design-patterns/visitor)
