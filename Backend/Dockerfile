FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# UID 1000 casa com o dono usual do checkout no host, para o bind mount de
# importacao_logs/ continuar gravável. Sobrescreva com --build-arg APP_UID=...
ARG APP_UID=1000
RUN useradd --uid "${APP_UID}" --create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p importacao_logs && chown app:app importacao_logs

USER app

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "120", "app:app"]
