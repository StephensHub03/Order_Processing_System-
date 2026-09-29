"""The latest batch's validation errors, written with Python logging."""
import json
import logging
from pathlib import Path

LOG_PATH = Path(__file__).parent / 'logs' / 'errors.log'


def write_errors(errors, path=LOG_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.Logger('order-validation', level=logging.ERROR)
    handler = logging.FileHandler(path, mode='w', encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
    try:
        for error in errors:
            # JSON lines preserve structured IDs and safely escape embedded newlines.
            logger.error(json.dumps({**error, 'description': f"Order {error['order_id']}: {error['message']}"}))
    finally:
        handler.close()
        logger.removeHandler(handler)


def read_errors(path=LOG_PATH):
    if not Path(path).exists():
        return []
    result = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if line.strip():
            entry = json.loads(line)
            item = {'order_id': entry['order_id'], 'message': entry['message']}
            if 'created_at' in entry and entry['created_at']:
                item['created_at'] = entry['created_at']
            result.append(item)
    return result
