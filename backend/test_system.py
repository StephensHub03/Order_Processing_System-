"""Run with: python3 -m unittest -v"""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import app
import database
from logger import read_errors
from processor import DEFAULT_SOURCE, load_orders, process_orders
from validator import validate_order


class OrderSystemTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = self.root / 'orders.db'
        self.log = self.root / 'logs' / 'errors.log'
        self.source = self.root / 'input.json'

    def process(self, orders=None):
        source = DEFAULT_SOURCE
        if orders is not None:
            self.source.write_text(json.dumps(orders))
            source = self.source
        return process_orders(source, self.db, self.log)

    def test_sample_totals_and_invalid_logs(self):
        result = self.process()
        self.assertEqual((result['valid_orders'], result['invalid_orders']), (3, 5))
        self.assertEqual(database.get_summary(self.db), dict(total_orders=8, valid_orders=3, invalid_orders=5, total_sales=1573.0))
        self.assertEqual(database.get_order(101, self.db)['total'], 850)
        self.assertEqual(len(database.get_order(101, self.db)['items']), 2)
        self.assertIsNone(database.get_order(103, self.db))
        self.assertEqual(len(read_errors(self.log)), 5)
        self.assertEqual(database.get_customer_summary(self.db), [{'customer': 'Ravi Stores', 'total': 1123.0}, {'customer': 'ABC Mart', 'total': 450.0}])

    def test_reprocessing_replaces_batch_without_duplicates(self):
        self.process()
        self.process()
        self.assertEqual(len(database.get_orders(self.db)), 3)
        self.assertEqual(len(read_errors(self.log)), 5)
        self.process([])
        self.assertEqual(database.get_orders(self.db), [])
        self.assertEqual(read_errors(self.log), [])

    def test_invalid_entries_do_not_stop_later_valid_order(self):
        valid = {'order_id': -1, 'customer': "O'Brien", 'items': [{'product': 'Soap', 'qty': 0.5, 'rate': 1.01}]}
        result = self.process([None, 4, {}, {'order_id': True}, valid, valid])
        self.assertEqual((result['valid_orders'], result['invalid_orders']), (1, 5))
        self.assertEqual(database.get_order(-1, self.db)['total'], 0.51)
        self.assertIn('Duplicate', read_errors(self.log)[-1]['message'])

    def test_numeric_and_item_edge_cases(self):
        for value in (True, False, '5', 0, -1, float('inf'), float('nan'), 10**400):
            order = {'order_id': 1, 'customer': 'Shop', 'items': [{'product': 'A', 'qty': value, 'rate': 1}]}
            self.assertTrue(validate_order(order), repr(value))
        for item in (None, [], 'bad'):
            self.assertTrue(validate_order({'order_id': 1, 'customer': 'Shop', 'items': [item]}))

    def test_large_positive_numbers_and_overflow(self):
        def order(order_id, qty, rate):
            return {'order_id': order_id, 'customer': 'Shop', 'items': [{'product': 'A', 'qty': qty, 'rate': rate}]}
        result = self.process([order(1, 1e13, 1), order(2, 1e308, 1e308), order(3, 1, 2)])
        self.assertEqual((result['valid_orders'], result['invalid_orders']), (2, 1))
        self.assertEqual(database.get_order(1, self.db)['total'], 1e13)
        self.assertIn('numeric range', read_errors(self.log)[0]['message'])

    def test_bad_source_preserves_existing_data(self):
        self.process()
        for content in ('{bad json', '{"orders": []}'):
            self.source.write_text(content)
            with self.assertRaises(ValueError):
                process_orders(self.source, self.db, self.log)
            self.assertEqual(len(database.get_orders(self.db)), 3)
        with self.assertRaises(ValueError):
            load_orders(self.root / 'missing.json')

    def test_transaction_rolls_back_and_foreign_keys_are_active(self):
        self.process()
        order = database.get_order(101, self.db)
        with self.assertRaises(Exception):
            database.save_batch([order, order], 0, self.db)
        self.assertEqual(len(database.get_orders(self.db)), 3)
        with database.connect(self.db) as db:
            self.assertEqual(db.execute('PRAGMA foreign_keys').fetchone()[0], 1)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_api_error_responses(self):
        client = app.app.test_client()
        self.assertEqual(client.get('/api/health').json, {'status': 'ok'})
        self.assertEqual(client.get('/api/no-such-route').status_code, 404)
        self.assertEqual(client.get('/api/process').status_code, 405)
        with patch('app.process_orders', side_effect=ValueError('Invalid JSON input')):
            response = client.post('/api/process')
            self.assertEqual(response.status_code, 400)
            self.assertIn('Invalid JSON', response.json['error'])
        with patch('app.database.get_orders', side_effect=RuntimeError('test failure')):
            with self.assertLogs(app.app.logger, level='ERROR'):
                response = client.get('/api/orders')
            self.assertEqual(response.status_code, 500)
            self.assertIn('error', response.json)
        response = client.get('/api/health', headers={'Origin': 'http://localhost:5173'})
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')

    def test_order_dates_preservation(self):
        orders = [
            {'order_id': 201, 'date': '2026-09-01', 'customer': 'Shop A', 'items': [{'product': 'A', 'qty': 1, 'rate': 10}]},
            {'order_id': 202, 'date': '2026-09-05', 'customer': '', 'items': [{'product': 'B', 'qty': 1, 'rate': 20}]},
        ]
        result = self.process(orders)
        self.assertEqual((result['valid_orders'], result['invalid_orders']), (1, 1))
        order_201 = database.get_order(201, self.db)
        self.assertTrue(order_201['created_at'].startswith('2026-09-01'))
        errors = read_errors(self.log)
        self.assertEqual(len(errors), 1)
        self.assertTrue(errors[0].get('created_at', '').startswith('2026-09-05'))

    def test_evaluate_endpoint(self):
        client = app.app.test_client()
        res = client.post('/api/evaluate', json={'text': '{bad json'})
        self.assertEqual(res.status_code, 400)
        res = client.post('/api/evaluate', json={'text': '{"order_id": 1}'})
        self.assertEqual(res.status_code, 400)
        sample = json.dumps([
            {'order_id': 1, 'date': '2026-09-20', 'customer': 'Store A', 'items': [{'product': 'Pen', 'qty': 2, 'rate': 10}]},
            {'order_id': 2, 'date': '2026-09-20', 'customer': '', 'items': [{'product': 'Ink', 'qty': 1, 'rate': 5}]},
        ])
        res = client.post('/api/evaluate', json={'text': sample})
        self.assertEqual(res.status_code, 200)
        data = res.json
        self.assertEqual((data['valid_orders'], data['invalid_orders']), (1, 1))
        self.assertEqual(data['total_sales'], 20.0)
        self.assertEqual(len(data['valid']), 1)
        self.assertEqual(len(data['invalid']), 1)
        self.assertEqual(len(data['customers']), 1)


if __name__ == '__main__':
    unittest.main()
