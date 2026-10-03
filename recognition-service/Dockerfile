FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 APP_ENV=production MODEL_DIR=/models
WORKDIR /srv
COPY requirements.txt requirements-ml.txt ./
# libgomp1: requerido por faiss/onnxruntime; las dependencias ML se omiten con --build-arg ML=0
ARG ML=1
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install -r requirements.txt \
    && if [ "$ML" = "1" ]; then pip install -r requirements-ml.txt; fi
COPY app ./app
RUN useradd -r -u 10001 susan && mkdir /models && chown susan /models
USER susan
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app_factory --factory --host 0.0.0.0 --port ${PORT:-8000}"]
