FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/scanner_service/requirements.txt /tmp/requirements-scanner.txt
COPY backend/version_service/requirements.txt /tmp/requirements-version.txt
COPY backend/drivers_service/requirements.txt /tmp/requirements-drivers.txt
COPY backend/system_monitor_service/requirements.txt /tmp/requirements-monitor.txt
RUN pip install --no-cache-dir \
    -r /tmp/requirements-scanner.txt \
    -r /tmp/requirements-version.txt \
    -r /tmp/requirements-drivers.txt \
    -r /tmp/requirements-monitor.txt

COPY backend /app

EXPOSE 8003
CMD ["uvicorn", "system_monitor_service.main:app", "--host", "0.0.0.0", "--port", "8003"]
