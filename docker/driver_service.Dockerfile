FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends pciutils \
    && rm -rf /var/lib/apt/lists/*

COPY backend/drivers_service/requirements.txt /tmp/requirements-drivers.txt
RUN pip install --no-cache-dir -r /tmp/requirements-drivers.txt

COPY . /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys,urllib.request;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3).status == 200 else 1)"

EXPOSE 8001
CMD ["uvicorn", "drivers_service.drivers_api:app", "--host", "0.0.0.0", "--port", "8001"]
