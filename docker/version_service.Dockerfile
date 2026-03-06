FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/version_service/requirements.txt /tmp/requirements-version.txt
RUN pip install --no-cache-dir -r /tmp/requirements-version.txt

COPY backend /app

EXPOSE 8002
CMD ["uvicorn", "version_service.main:app", "--host", "0.0.0.0", "--port", "8002"]
