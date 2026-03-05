FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/scanner_service/requirements.txt /tmp/requirements-scanner.txt
COPY backend/version_service/requirements.txt /tmp/requirements-version.txt
COPY backend/drivers_service/requirements.txt /tmp/requirements-drivers.txt

RUN pip install --no-cache-dir \
    -r /tmp/requirements-scanner.txt \
    -r /tmp/requirements-version.txt \
    -r /tmp/requirements-drivers.txt

COPY backend /app/backend
COPY docker/start_single_container.py /app/start_single_container.py
COPY --from=frontend-build /frontend/build /app/frontend_build

EXPOSE 3000 8000 8001 8002

CMD ["python", "/app/start_single_container.py"]
