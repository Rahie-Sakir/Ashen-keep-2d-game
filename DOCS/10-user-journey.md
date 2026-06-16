# User Journey

## Stage 1: Launch

The user opens the Ashen Keep application.

System actions:
- Load required modules.
- Initialize backend.
- Prepare rendering engine.
- Configure input handling.

---

## Stage 2: Game Initialization

The game creates the initial world state and prepares player interaction.

---

## Stage 3: Gameplay

The player provides keyboard input.

The application:
- Detects user actions.
- Processes input.
- Updates game logic.
- Renders the updated scene.

This cycle repeats continuously throughout gameplay.

---

## Stage 4: Ongoing Interaction

Players continue interacting with the game while the backend manages internal state and the frontend reflects those updates visually.

---

## Stage 5: Exit

When the user closes the application:

- Resources are released.
- Active processes terminate.
- The program exits gracefully.

## Journey Summary

```
Launch
   │
   ▼
Initialize Game
   │
   ▼
Receive Player Input
   │
   ▼
Process Game Logic
   │
   ▼
Render Updated Scene
   │
   ▼
Repeat Gameplay Loop
   │
   ▼
Exit Application
```