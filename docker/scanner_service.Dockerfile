FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend

WORKDIR /app

COPY backend/scanner_service/requirements.txt /tmp/requirements-scanner.txt
RUN pip install --no-cache-dir -r /tmp/requirements-scanner.txt

COPY . /app

EXPOSE 8000
CMD ["uvicorn", "scanner_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
