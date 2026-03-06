System Revamp is a modernized application designed to scan, analyze, and display the list of installed applications on a user's system with an intuitive and user-friendly interface. Built with a React-based frontend and a Python-powered backend, the project emphasizes both performance and usability. The backend leverages Python scripts to extract installed software details across platforms, while the frontend presents this data in a clean, interactive UI.

The frontend is implemented using React and Material-UI, ensuring responsive design, smooth animations, and easy navigation. It now includes a cloud monitoring dashboard for multi-machine visibility with live updates.

The backend integrates system-level commands to fetch application data, parse it into structured formats, and expose it through REST APIs for the frontend to consume. A new Cloud Security Core service centralizes machine registration, scan ingestion, global analytics, and websocket broadcasts.

The goal of System Revamp is to give users a centralized hub for system visibility, helping them quickly identify unused, outdated, or suspicious applications. This not only enhances user control but also supports better system health, optimization, and security management.

## Docker

This repository includes an independent multi-service Docker setup.

### Start everything

```bash
docker compose up --build
```

### Services

- Frontend: http://localhost:3000
- Scanner API: http://localhost:8000
- Drivers API: http://localhost:8001
- Version API: http://localhost:8002
- System Monitor API: http://localhost:8003
- Cloud Security Core API: http://localhost:9000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Cloud dashboard login

- Username: `admin`
- Password: `admin123`

Change these with `CLOUD_ADMIN_USERNAME` and `CLOUD_ADMIN_PASSWORD` in `docker-compose.yml`.

### Stop

```bash
docker compose down
```

### Important behavior note

The scanner and driver services inspect the runtime environment they run in. Inside containers, they scan the container OS, not your host machine.

### Cloud agent behavior

`system_monitor_service` includes a real uploader loop:

- Registers each machine once via `POST /register-machine`
- Stores machine identity in `backend/cache/cloud_agent_identity.json`
- Every 60 seconds performs fast scan + metrics collection and uploads real payloads to `POST /upload-scan`
