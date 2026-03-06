FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/drivers_service/requirements.txt /tmp/requirements-drivers.txt
RUN pip install --no-cache-dir -r /tmp/requirements-drivers.txt

COPY backend /app

EXPOSE 8001
CMD ["uvicorn", "drivers_service.drivers_api:app", "--host", "0.0.0.0", "--port", "8001"]
