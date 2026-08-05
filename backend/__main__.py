"""Run the SoulsFan Games API with Uvicorn.

Environment variables:
    PORT: HTTP port (default: 4000)
    HOST: bind address (default: 0.0.0.0)
    DB_PATH: JSON database path (default: backend/db.json)
"""

from __future__ import annotations

import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the SoulsFan Games API")
    parser.add_argument(
        "--reload",
        action="store_true",
        help="restart the development server when Python files change",
    )
    args = parser.parse_args()

    uvicorn.run(
        "backend.app:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "4000")),
        reload=args.reload,
    )


if __name__ == "__main__":
    main()

