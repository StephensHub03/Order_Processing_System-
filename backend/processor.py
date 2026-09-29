"""Run: python3 processor.py [orders.json | https://example.com/orders.json]."""
import argparse
import json
import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from pathlib import Path
from threading import RLock
from urllib.error import URLError
from urllib.request import urlopen

from database import DB_PATH, init_db, save_batch
from logger import LOG_PATH, write_errors
from validator import validate_order

DEFAULT_SOURCE = Path(__file__).parent / 'orders.json'
PROCESS_LOCK = RLock()


def load_orders(source):
    try:
        if str(source).startswith(('http://', 'https://')):
            with urlopen(str(source), timeout=15) as response:
                raw = response.read(5_000_001)
        else:
            with open(source, 'rb') as file:
                raw = file.read(5_000_001)
        orders = load_orders_from_bytes(raw)
    except (OSError, URLError) as exc:
        raise ValueError(f'Unable to read order source: {exc}') from exc
    return orders


def load_orders_from_bytes(raw):
    if len(raw) > 5_000_000:
        raise ValueError('Order source exceeds the 5 MB limit')
    try:
        orders = json.loads(raw)
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f'Invalid JSON input: {exc}') from exc
    if not isinstance(orders, list):
        raise ValueError('Input JSON must be a list of orders')
    return orders



def calculate_items(items):
    calculated = []
    # Enough precision for products of finite floating-point inputs before rounding.
    with localcontext() as context:
        context.prec = 700
        for item in items:
            amount = (Decimal(str(item['qty'])) * Decimal(str(item['rate']))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if not math.isfinite(float(amount)):
                raise ValueError('Item amount exceeds the supported numeric range')
            calculated.append({**item, 'product': item['product'].strip(), 'amount': float(amount)})
        total = float(sum((Decimal(str(i['amount'])) for i in calculated), Decimal(0)))
        if not math.isfinite(total):
            raise ValueError('Order total exceeds the supported numeric range')
    return calculated, total

def extract_order_date(order):
    if not isinstance(order, dict):
        return datetime.now(timezone.utc).isoformat()
    raw = order.get('date') or order.get('created_at') or order.get('order_date') or order.get('timestamp')
    if raw is None or raw == '':
        return datetime.now(timezone.utc).isoformat()
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc).isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()
    if isinstance(raw, str):
        raw_str = raw.strip()
        if len(raw_str) == 10 and raw_str.count('-') == 2:
            try:
                dt = datetime.fromisoformat(raw_str)
                return dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
        try:
            iso_str = raw_str.replace('Z', '+00:00')
            dt = datetime.fromisoformat(iso_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass
        return raw_str
    return datetime.now(timezone.utc).isoformat()


def process_order_records(orders, db_path=DB_PATH, log_path=LOG_PATH, verbose=False):
    valid, errors, seen = [], [], set()
    for index, order in enumerate(orders, 1):
        reasons = validate_order(order)
        order_id = order.get('order_id') if isinstance(order, dict) else None
        if not reasons and order_id in seen:
            reasons.append('Duplicate order ID in this batch')
        if not reasons:
            try:
                items, total = calculate_items(order['items'])
            except ValueError as exc:
                reasons.append(str(exc))
        if reasons:
            message = '; '.join(reasons)
            order_date = extract_order_date(order) if isinstance(order, dict) else None
            errors.append({'order_id': order_id, 'message': message, 'created_at': order_date})
            if verbose:
                print(f'Order {order_id if order_id is not None else "at position " + str(index)}: INVALID - {message}')
            continue
        seen.add(order_id)
        order_date = extract_order_date(order)
        valid.append({'order_id': order_id, 'customer': order['customer'].strip(), 'items': items,
                      'total': total, 'created_at': order_date})
        if verbose:
            print(f'Order {order_id}: VALID - Total = {total:.2f}')
    init_db(db_path)
    save_batch(valid, len(errors), db_path)
    write_errors(errors, log_path)
    return {'valid_orders': len(valid), 'invalid_orders': len(errors), 'orders': valid}


def process_orders(source=DEFAULT_SOURCE, db_path=DB_PATH, log_path=LOG_PATH, verbose=False):
    with PROCESS_LOCK:
        orders = load_orders(source)  # A bad source must leave the previous batch intact.
        return process_order_records(orders, db_path, log_path, verbose)


def process_orders_bytes(raw, db_path=DB_PATH, log_path=LOG_PATH, verbose=False):
    with PROCESS_LOCK:
        orders = load_orders_from_bytes(raw)
        return process_order_records(orders, db_path, log_path, verbose)


def evaluate_order_records(orders):
    valid, errors, seen = [], [], set()
    customer_totals = {}
    total_sales = Decimal(0)
    for index, order in enumerate(orders, 1):
        reasons = validate_order(order)
        order_id = order.get('order_id') if isinstance(order, dict) else None
        if not reasons and order_id in seen:
            reasons.append('Duplicate order ID in this batch')
        if not reasons:
            try:
                items, total = calculate_items(order['items'])
            except ValueError as exc:
                reasons.append(str(exc))
        if reasons:
            message = '; '.join(reasons)
            order_date = extract_order_date(order) if isinstance(order, dict) else None
            errors.append({
                'index': index,
                'order_id': order_id,
                'customer': order.get('customer') if isinstance(order, dict) else None,
                'message': message,
                'reasons': reasons,
                'created_at': order_date,
                'order_preview': order if isinstance(order, (dict, list, str, int, float)) else str(order)
            })
            continue
        seen.add(order_id)
        order_date = extract_order_date(order)
        order_obj = {
            'index': index,
            'order_id': order_id,
            'customer': order['customer'].strip(),
            'items': items,
            'total': total,
            'created_at': order_date
        }
        valid.append(order_obj)
        cust = order_obj['customer']
        customer_totals[cust] = customer_totals.get(cust, Decimal(0)) + Decimal(str(total))
        total_sales += Decimal(str(total))

    cust_summary = [
        {'customer': cust, 'total': float(tot.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))}
        for cust, tot in sorted(customer_totals.items(), key=lambda x: (-x[1], x[0]))
    ]
    return {
        'total_orders': len(orders),
        'valid_orders': len(valid),
        'invalid_orders': len(errors),
        'pass_rate': round((len(valid) / max(len(orders), 1)) * 100, 1),
        'total_sales': float(total_sales.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
        'valid': valid,
        'invalid': errors,
        'customers': cust_summary
    }


def main():
    parser = argparse.ArgumentParser(description='Validate JSON orders and save them to SQLite')
    parser.add_argument('source', nargs='?', default=str(DEFAULT_SOURCE), help='JSON file or HTTP(S) URL')
    parser.add_argument('--process', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    print('=' * 40 + '\n       ORDER PROCESSING SYSTEM\n' + '=' * 40 + '\n\nProcessing orders...\n')
    try:
        result = process_orders(args.source, verbose=True)
    except (ValueError, OSError) as exc:
        parser.exit(1, f'Error: {exc}\n')
    print('\n' + '=' * 40 + '\nSUMMARY\n' + '=' * 40)
    print(f"\nValid Orders   : {result['valid_orders']}\nInvalid Orders : {result['invalid_orders']}\n\nTOTAL PER CUSTOMER\n")
    totals = {}
    for order in result['orders']:
        totals[order['customer']] = totals.get(order['customer'], 0) + order['total']
    for customer, total in totals.items():
        print(f'{customer:<20}: {total:.2f}')
    print('\n' + '=' * 40)


if __name__ == '__main__':
    main()
