"""SQLite storage, with an atomic replacement of each processed batch."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / 'orders.db'


@contextmanager
def connect(path=DB_PATH):
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def init_db(path=DB_PATH):
    with connect(path) as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER UNIQUE NOT NULL,
                customer TEXT NOT NULL,
                total REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
                product TEXT NOT NULL,
                qty REAL NOT NULL,
                rate REAL NOT NULL,
                amount REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS processing_summary (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_orders INTEGER NOT NULL,
                valid_orders INTEGER NOT NULL,
                invalid_orders INTEGER NOT NULL
            );
        ''')


def save_batch(orders, invalid_count, path=DB_PATH):
    with connect(path) as db:
        db.execute('DELETE FROM order_items')
        db.execute('DELETE FROM orders')
        for order in orders:
            db.execute('INSERT INTO orders (order_id, customer, total, created_at) VALUES (?, ?, ?, ?)',
                       (order['order_id'], order['customer'], order['total'], order['created_at']))
            db.executemany('INSERT INTO order_items (order_id, product, qty, rate, amount) VALUES (?, ?, ?, ?, ?)',
                           [(order['order_id'], i['product'], i['qty'], i['rate'], i['amount']) for i in order['items']])
        db.execute('INSERT OR REPLACE INTO processing_summary VALUES (1, ?, ?, ?)',
                   (len(orders) + invalid_count, len(orders), invalid_count))


def get_orders(path=DB_PATH):
    with connect(path) as db:
        orders = [dict(row) for row in db.execute('SELECT order_id, customer, total, created_at FROM orders ORDER BY order_id')]
        items_by_order = {}
        for row in db.execute('SELECT order_id, product, qty, rate, amount FROM order_items ORDER BY id'):
            items_by_order.setdefault(row['order_id'], []).append(dict(row))
        for order in orders:
            order['items'] = items_by_order.get(order['order_id'], [])
        return orders


def get_order(order_id, path=DB_PATH):
    with connect(path) as db:
        row = db.execute('SELECT order_id, customer, total, created_at FROM orders WHERE order_id = ?', (order_id,)).fetchone()
        if row is None:
            return None
        order = dict(row)
        order['items'] = [dict(i) for i in db.execute('SELECT product, qty, rate, amount FROM order_items WHERE order_id = ? ORDER BY id', (order_id,))]
        return order


def get_summary(path=DB_PATH):
    with connect(path) as db:
        row = db.execute('SELECT total_orders, valid_orders, invalid_orders FROM processing_summary WHERE id = 1').fetchone()
        result = dict(row) if row else dict(total_orders=0, valid_orders=0, invalid_orders=0)
        result['total_sales'] = round(db.execute('SELECT COALESCE(SUM(total), 0) FROM orders').fetchone()[0], 2)
        return result


def get_customer_summary(path=DB_PATH):
    with connect(path) as db:
        return [dict(row) for row in db.execute('SELECT customer, ROUND(SUM(total), 2) AS total FROM orders GROUP BY customer ORDER BY total DESC, customer')]
