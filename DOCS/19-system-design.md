# System Design

## Overview

Ashen Keep follows a modular software architecture where each major responsibility is assigned to an independent component.

This separation improves maintainability, readability, and future scalability.

---

## High-Level Architecture

```
                 +------------------+
                 |      Player      |
                 +---------+--------+
                           |
                           v
                 +------------------+
                 |  Input Bindings  |
                 +---------+--------+
                           |
                           v
                 +------------------+
                 |  Game Backend    |
                 +---------+--------+
                           |
                           v
                 +------------------+
                 | Game Frontend    |
                 +---------+--------+
                           |
                           v
                 +------------------+
                 |     Display      |
                 +------------------+
```

---

## Component Responsibilities

### main.py

- Entry point of the application.
- Initializes required modules.
- Starts the game loop.

### game_backend.py

Responsible for:

- Maintaining game state.
- Processing gameplay logic.
- Updating entities.
- Managing internal mechanics.

### game_frontend.py

Responsible for:

- Rendering graphics.
- Updating the user interface.
- Displaying backend state visually.

### game_frontend_3d.py

Provides enhanced rendering support and visualization features where applicable.

### input_bindings.py

Responsible for:

- Keyboard event detection.
- Mapping user actions to gameplay commands.

### test_game.py

Provides automated tests to verify functionality and detect regressions.

---

## Design Principles

- Separation of concerns
- Modularity
- Reusability
- Maintainability
- Testability