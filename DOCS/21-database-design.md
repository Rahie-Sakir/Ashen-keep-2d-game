# Database Design

## Current Implementation

The current version of Ashen Keep does not utilize a persistent database.

All runtime information is stored temporarily in application memory while the game is executing.

---

## Runtime Data

Examples of in-memory data include:

- Player position
- Health values
- Current game state
- Enemy status
- Session progress
- World objects

These values are discarded when the application terminates.

---

## Rationale

For a standalone desktop game of this scope, introducing a database would add unnecessary complexity without significant benefit.

Memory-based state management provides:

- Faster access
- Simpler implementation
- Reduced dependencies
- Easier debugging

---

## Potential Future Database Schema

If persistence is added, the following tables may be implemented:

### Player

| Field | Type |
|---------|------|
| id | INTEGER |
| health | INTEGER |
| position | TEXT |
| inventory | TEXT |

### SaveGame

| Field | Type |
|---------|------|
| save_id | INTEGER |
| timestamp | DATETIME |
| player_id | INTEGER |
| progress | TEXT |

### Statistics

| Field | Type |
|---------|------|
| session_id | INTEGER |
| score | INTEGER |
| play_time | INTEGER |

SQLite would be an appropriate lightweight solution for future development.