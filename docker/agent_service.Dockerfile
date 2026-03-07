FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends pciutils \
    && rm -rf /var/lib/apt/lists/*

COPY backend/scanner_service/requirements.txt /tmp/requirements-scanner.txt
COPY backend/version_service/requirements.txt /tmp/requirements-version.txt
COPY backend/drivers_service/requirements.txt /tmp/requirements-drivers.txt
COPY backend/system_monitor_service/requirements.txt /tmp/requirements-monitor.txt
COPY backend/agent_service/requirements.txt /tmp/requirements-agent.txt
RUN pip install --no-cache-dir \
    -r /tmp/requirements-scanner.txt \
    -r /tmp/requirements-version.txt \
    -r /tmp/requirements-drivers.txt \
    -r /tmp/requirements-monitor.txt \
    -r /tmp/requirements-agent.txt

COPY . /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys,urllib.request;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8004/health', timeout=3).status == 200 else 1)"

EXPOSE 8004
CMD ["uvicorn", "agent_service.main:app", "--host", "0.0.0.0", "--port", "8004"]
