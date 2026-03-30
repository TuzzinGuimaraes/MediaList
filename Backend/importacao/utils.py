"""
Utilitários compartilhados pelos importadores.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import logging
import re
import time
import traceback
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

LOG_DIR = Path(__file__).resolve().parent.parent / 'importacao_logs'
LOG_DIR.mkdir(exist_ok=True)

LOG_PATH = LOG_DIR / 'importacao.log'
ERROR_LOG_PATH = LOG_DIR / 'importacao_erros.jsonl'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)


@dataclass
class ImportStats:
    """Resumo acumulado de uma importação."""

    tipo_midia: str
    origem: str
    processados: int = 0
    sucessos: int = 0
    falhas: int = 0
    ja_existia: int = 0

    def registrar_sucesso(self, *, ja_existia: bool = False):
        self.processados += 1
        self.sucessos += 1
        if ja_existia:
            self.ja_existia += 1

    def registrar_falha(self):
        self.processados += 1
        self.falhas += 1

    def merge(self, other: 'ImportStats'):
        self.processados += other.processados
        self.sucessos += other.sucessos
        self.falhas += other.falhas
        self.ja_existia += other.ja_existia

    def to_dict(self) -> dict:
        return asdict(self)


class RateLimiter:
    """Garante um intervalo mínimo entre chamadas de API."""

    def __init__(self, min_interval_seconds: float):
        self.min_interval = min_interval_seconds
        self._last_call = 0.0
        self._lock = Lock()

    def wait(self):
        with self._lock:
            elapsed = time.monotonic() - self._last_call
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()


def executar_em_paralelo(itens, worker_fn, max_workers: int = 1):
    """Executa tarefas em paralelo e retorna item, resultado e exceção."""
    itens = list(itens)
    if max_workers <= 1:
        for item in itens:
            try:
                yield item, worker_fn(item), None
            except Exception as exc:
                yield item, None, exc
        return

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_item = {executor.submit(worker_fn, item): item for item in itens}
        for future in as_completed(future_to_item):
            item = future_to_item[future]
            try:
                yield item, future.result(), None
            except Exception as exc:
                yield item, None, exc


def criar_sessao_http(
    *,
    total_retries: int = 3,
    backoff_factor: float = 1.0,
    pool_connections: int = 10,
    pool_maxsize: int = 10,
) -> requests.Session:
    """Cria uma sessão HTTP com retry e reaproveitamento de conexão."""
    retry = Retry(
        total=total_retries,
        read=total_retries,
        connect=total_retries,
        backoff_factor=backoff_factor,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=None,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(
        max_retries=retry,
        pool_connections=pool_connections,
        pool_maxsize=pool_maxsize,
    )

    session = requests.Session()
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session


def registrar_falha_importacao(
    *,
    tipo_midia: str,
    origem: str,
    exc: Exception,
    identificador: str | int | None = None,
    titulo: str | None = None,
    payload: dict | list | str | None = None,
    extra: dict | None = None,
):
    """Registra falhas de importação sem interromper a execução."""
    traceback_text = (
        ''.join(traceback.format_exception(exc.__class__, exc, exc.__traceback__))
        if exc.__traceback__ is not None
        else ''
    )
    record = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tipo_midia': tipo_midia,
        'origem': origem,
        'identificador': identificador,
        'titulo': titulo,
        'erro_tipo': exc.__class__.__name__,
        'erro': str(exc),
        'payload': payload,
        'extra': extra or {},
        'traceback': traceback_text,
    }

    with ERROR_LOG_PATH.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(record, ensure_ascii=False, default=str))
        handle.write('\n')

    logger.error(
        'Falha ao importar %s (%s/%s): %s',
        titulo or identificador or 'item_sem_identificador',
        tipo_midia,
        origem,
        exc,
    )


def remover_html(texto: str | None) -> str | None:
    """Remove tags HTML simples de uma string."""
    if not texto:
        return None
    return re.sub(r'<[^>]+>', '', texto).replace('&quot;', '"').replace('&#039;', "'").strip()


def truncar(texto: str | None, max_len: int) -> str | None:
    if texto and len(texto) > max_len:
        return texto[: max_len - 3] + '...'
    return texto


def formatar_data_parcial(data_raw: str | None) -> str | None:
    """Normaliza datas parciais YYYY ou YYYY-MM."""
    if not data_raw:
        return None

    partes = data_raw.split('-')
    if len(partes) == 1:
        return f'{partes[0]}-01-01'
    if len(partes) == 2:
        return f'{partes[0]}-{partes[1]}-01'
    return data_raw


def formatar_data_anilist(start_date: dict | None) -> str | None:
    """Monta YYYY-MM-DD a partir da estrutura do AniList."""
    if not start_date or not start_date.get('year'):
        return None

    mes = start_date.get('month') or 1
    dia = start_date.get('day') or 1
    return f"{start_date['year']}-{mes:02d}-{dia:02d}"
