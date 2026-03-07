FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/backend

WORKDIR /app

COPY cloud_core/requirements.txt /tmp/requirements-cloud.txt
RUN pip install --no-cache-dir -r /tmp/requirements-cloud.txt

COPY . /app

EXPOSE 9000
CMD ["uvicorn", "cloud_core.main:app", "--host", "0.0.0.0", "--port", "9000"]
