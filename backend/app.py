import json
import sys
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

import database
from logger import LOG_PATH, read_errors
from processor import PROCESS_LOCK, evaluate_order_records, process_order_records, process_orders, process_orders_bytes

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
CORS(app, resources={r'/api/*': {'origins': ['http://localhost:5173', 'http://127.0.0.1:5173']}})
database.init_db()
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
LOG_PATH.touch(exist_ok=True)


@app.get('/api/health')
def health():
    return jsonify(status='ok')


@app.post('/api/process')
def process():
    try:
        result = process_orders()
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    return jsonify(message='Orders processed successfully', valid_orders=result['valid_orders'], invalid_orders=result['invalid_orders'])


@app.post('/api/process/upload')
def process_upload():
    uploaded = request.files.get('file')
    if uploaded is None or not uploaded.filename:
        return jsonify(error='Please upload a JSON file'), 400
    if not uploaded.filename.lower().endswith('.json'):
        return jsonify(error='Only .json files are supported'), 400
    try:
        result = process_orders_bytes(uploaded.read(5_000_001))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    return jsonify(message=f'{uploaded.filename} validated successfully', valid_orders=result['valid_orders'], invalid_orders=result['invalid_orders'])


@app.post('/api/evaluate')
def evaluate():
    orders = None
    if request.is_json:
        payload = request.get_json(silent=True)
        if isinstance(payload, dict) and 'text' in payload:
            text = payload['text']
            if not isinstance(text, str) or not text.strip():
                return jsonify(error='JSON text cannot be empty'), 400
            try:
                orders = json.loads(text)
            except Exception as exc:
                return jsonify(error=f'Invalid JSON syntax: {exc}'), 400
        elif isinstance(payload, list):
            orders = payload
        else:
            return jsonify(error='Expected a JSON array of orders or {"text": "..."}'), 400
    elif 'file' in request.files:
        uploaded = request.files.get('file')
        if not uploaded or not uploaded.filename:
            return jsonify(error='Please upload a file'), 400
        try:
            content = uploaded.read(5_000_001).decode('utf-8')
            orders = json.loads(content)
        except Exception as exc:
            return jsonify(error=f'Failed to read or parse JSON file: {exc}'), 400
    else:
        raw_text = request.get_data(as_text=True)
        if raw_text and raw_text.strip():
            try:
                orders = json.loads(raw_text)
            except Exception as exc:
                return jsonify(error=f'Invalid JSON syntax: {exc}'), 400
        else:
            return jsonify(error='No JSON content received'), 400

    if not isinstance(orders, list):
        return jsonify(error='Top-level JSON must be an array of order objects, e.g. [{"order_id": ...}]'), 400

    result = evaluate_order_records(orders)
    return jsonify(result)


@app.post('/api/process/raw')
def process_raw():
    payload = request.get_json(silent=True)
    if isinstance(payload, dict) and 'text' in payload:
        try:
            orders = json.loads(payload['text'])
        except Exception as exc:
            return jsonify(error=f'Invalid JSON syntax: {exc}'), 400
    elif isinstance(payload, list):
        orders = payload
    else:
        return jsonify(error='Expected a JSON array or {"text": "..."}'), 400

    if not isinstance(orders, list):
        return jsonify(error='Top-level JSON must be an array of order objects'), 400

    with PROCESS_LOCK:
        result = process_order_records(orders)
    return jsonify(message='Orders processed and saved to database successfully', valid_orders=result['valid_orders'], invalid_orders=result['invalid_orders'])


@app.get('/api/summary')
def summary():
    with PROCESS_LOCK:
        return jsonify(database.get_summary())


@app.get('/api/orders')
def orders():
    with PROCESS_LOCK:
        return jsonify(database.get_orders())


@app.get('/api/orders/<int(signed=True):order_id>')
def order(order_id):
    with PROCESS_LOCK:
        result = database.get_order(order_id)
    return jsonify(result) if result else (jsonify(error='Order not found'), 404)


@app.get('/api/errors')
def errors():
    with PROCESS_LOCK:
        return jsonify(read_errors())


@app.get('/api/customers/summary')
def customers():
    with PROCESS_LOCK:
        return jsonify(database.get_customer_summary())


@app.errorhandler(Exception)
def handle_error(error):
    if isinstance(error, HTTPException):
        return jsonify(error=error.description), error.code
    app.logger.exception('Request failed')
    return jsonify(error='Internal server error. Please check the backend console.'), 500


if __name__ == '__main__':
    if '--process' in sys.argv:
        from processor import main
        main()
    else:
        app.run(host='127.0.0.1', port=5000, debug=False)
