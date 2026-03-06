FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY scanner_service/requirements.txt /tmp/requirements-scanner.txt
COPY version_service/requirements.txt /tmp/requirements-version.txt
COPY drivers_service/requirements.txt /tmp/requirements-drivers.txt
COPY system_monitor_service/requirements.txt /tmp/requirements-monitor.txt

RUN pip install --no-cache-dir \
    -r /tmp/requirements-scanner.txt \
    -r /tmp/requirements-version.txt \
    -r /tmp/requirements-drivers.txt \
    -r /tmp/requirements-monitor.txt

COPY . /app

CMD ["uvicorn", "scanner_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
