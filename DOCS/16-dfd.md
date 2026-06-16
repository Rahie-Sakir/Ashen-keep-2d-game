# Data Flow Diagram (DFD)

## Level 0 DFD

```
                +----------------+
                |     Player     |
                +-------+--------+
                        |
                        | Keyboard Input
                        |
                        v
              +----------------------+
              |   Input Bindings      |
              +----------+-----------+
                         |
                         | Commands
                         |
                         v
              +----------------------+
              |    Game Backend       |
              +----------+-----------+
                         |
                         | Updated State
                         |
                         v
              +----------------------+
              |   Game Frontend       |
              +----------+-----------+
                         |
                         | Rendered Frame
                         |
                         v
                  +--------------+
                  |   Display    |
                  +--------------+
```

## Description

The player interacts with the system through keyboard input. The input module translates those actions into commands processed by the backend. The backend updates the game state, which is then rendered by the frontend and displayed to the user.