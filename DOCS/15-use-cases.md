# Use Cases

## UC-1: Launch Game

### Actor
Player

### Preconditions

- Application is installed.
- Required dependencies are available.

### Main Flow

1. User starts the application.
2. System initializes modules.
3. Backend loads game state.
4. Frontend prepares rendering.
5. Game begins.

### Postconditions

- Gameplay is active.

---

## UC-2: Control Player

### Actor

Player

### Main Flow

1. Player presses a key.
2. Input module detects the event.
3. Backend processes the action.
4. Game state updates.
5. Frontend redraws the scene.

### Postconditions

- Player action is reflected visually.

---

## UC-3: Continue Gameplay

### Actor

Player

### Main Flow

1. Game loop repeats.
2. Backend updates internal state.
3. Frontend renders changes.
4. User continues interacting.

### Postconditions

- Gameplay continues normally.

---

## UC-4: Exit Application

### Actor

Player

### Main Flow

1. Player requests exit.
2. System releases resources.
3. Application terminates.

### Postconditions

- Program closes successfully.