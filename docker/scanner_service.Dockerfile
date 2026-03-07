FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend

WORKDIR /app

COPY backend/scanner_service/requirements.txt /tmp/requirements-scanner.txt
RUN pip install --no-cache-dir -r /tmp/requirements-scanner.txt

COPY . /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys,urllib.request;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"

EXPOSE 8000
CMD ["uvicorn", "scanner_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
