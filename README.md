# Order Processing System

A complete, small order-processing application for a Python coding round. It reads JSON from a file or URL, skips invalid orders with clear reasons, calculates totals, saves valid orders to SQLite, and displays results in a React dashboard.

## Features and architecture

- File/HTTP(S) input through the Python CLI; the dashboard processes `backend/orders.json`.
- Per-order validation: one invalid order never interrupts the remaining valid orders.
- Item amounts, order totals, customer totals, and batch statistics calculated dynamically.
- SQLite transactions, foreign keys, parameterized queries, and persistent batch counts.
- Python logging to `backend/logs/errors.log`; structured errors exposed through Flask.
- Responsive dashboard with order details, customer bars, refresh/process actions, loading, empty, error, and success states.

```text
orders.json (or URL via CLI)
             |
       Python processor
             |
         Validation
         /        \
      VALID      INVALID
        |           |
      SQLite    errors.log
         \         /
           Flask API
               |
        React dashboard
```

The frontend only accesses the Flask APIs; it never opens SQLite.

## Stack

Python 3, Flask, Flask-CORS, SQLite and Python standard libraries; React, Vite and Tailwind CSS. Customer bars use CSS, so no chart dependency is necessary. No authentication, Docker, or external database is required.

## Folder structure

```text
order_processing_system/
├── .gitignore
├── README.md
├── backend/
│   ├── app.py
│   ├── processor.py
│   ├── validator.py
│   ├── database.py
│   ├── logger.py
│   ├── orders.json
│   ├── orders.db
│   ├── requirements.txt
│   ├── test_system.py
│   └── logs/
│       └── errors.log
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components/
        │   ├── Header.jsx
        │   ├── StatCard.jsx
        │   ├── OrdersTable.jsx
        │   ├── OrderDetailsModal.jsx
        │   ├── ValidationErrors.jsx
        │   └── CustomerSummary.jsx
        └── services/
            └── api.js
```

Installation also creates `backend/venv`, `frontend/node_modules`, and (after a build) `frontend/dist`.

## Installation and running

Prerequisites: Python 3.10+ and Node.js 20.19+ with npm. Open two terminals from the `order_processing_system` directory.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 processor.py
python3 app.py
```

On Windows, use `venv\Scripts\activate` instead of `source venv/bin/activate`.

Backend: **http://127.0.0.1:5000**. Health check: http://127.0.0.1:5000/api/health.

The supplied database and log are already populated with the sample batch. All data paths are relative to the Python files, so commands also work from another directory. The database and log directory are created automatically if absent.

On macOS, AirPlay Receiver may occupy port 5000 for `localhost`/IPv6. Use the explicit `127.0.0.1` address above; the frontend proxy already uses it. If Flask cannot bind at all, turn off AirPlay Receiver in macOS settings.

### Frontend (another terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend: **http://localhost:5173** or **http://127.0.0.1:5173**. Vite opens the browser automatically. Its `/api` proxy forwards requests to Flask on `127.0.0.1:5000`. Flask-CORS also permits both local frontend origins.

For subsequent runs, dependencies are already installed: activate the backend environment and run `python3 app.py`; in the other terminal run `npm run dev`.

### CLI options

```bash
cd backend
source venv/bin/activate
python3 processor.py
python3 app.py --process
python3 processor.py /path/to/orders.json
python3 processor.py https://example.com/orders.json
```

Replace the example URL with an actual JSON endpoint. Input must be a top-level JSON array. URL reads have a 15-second timeout; input is limited to 5 MB. Missing files, inaccessible URLs, malformed JSON, and incorrect top-level structures produce a clear error and nonzero CLI exit status, preserving the existing database batch.

## Validation rules

- `order_id`: required integer within SQLite's signed 64-bit integer range; booleans are rejected.
- `customer`: required nonblank string; surrounding whitespace is removed.
- `items`: required, nonempty list of objects.
- Each item needs a nonblank string `product` and numeric `qty` and `rate` greater than zero.
- Numeric strings, booleans, NaN and infinity are rejected. Values or calculated amounts outside the finite numeric range are rejected with a clear error.
- Duplicate order IDs within a batch are skipped; the first valid occurrence wins.
- All detected reasons for one invalid order are returned together. Invalid counts count orders, not individual field errors.

The eight sample orders include three valid orders plus empty customer, textual quantity, missing rate, empty items, and negative quantity cases.

## Processing decisions

Every successful processing operation **replaces the previous batch**. Repeated clicks do not duplicate orders, items, counts, or errors. This is a batch demonstration, not a historical order ledger. Errors describe the latest batch; they are not an append-only audit history.

Each valid item amount is calculated with `Decimal` and rounded half-up to two decimal places. Order totals sum those rounded item amounts. SQLite uses the requested `REAL` columns. Timestamps use UTC.

Database replacement is transactional: a database failure rolls back its writes. A lock serializes processing and reads in the single Flask process. SQLite and the log file are separate resources; they are not a distributed transaction. This project is designed for the supplied local development server, not multiple server workers.

## Database schema

`orders`:

| Column | Type / constraint |
| --- | --- |
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| order_id | INTEGER UNIQUE NOT NULL |
| customer | TEXT NOT NULL |
| total | REAL NOT NULL |
| created_at | TEXT NOT NULL |

`order_items`:

| Column | Type / constraint |
| --- | --- |
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| order_id | INTEGER NOT NULL, references orders(order_id), ON DELETE CASCADE |
| product | TEXT NOT NULL |
| qty | REAL NOT NULL |
| rate | REAL NOT NULL |
| amount | REAL NOT NULL |

`processing_summary`: one row with `id = 1`, `total_orders`, `valid_orders`, and `invalid_orders`. This small additional table preserves batch counts across backend restarts. Sales and customer totals are queried from stored orders.

## API endpoints

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/health` | `{"status":"ok"}` |
| POST | `/api/process` | Process the bundled JSON file; message and valid/invalid counts |
| GET | `/api/summary` | Total, valid, invalid orders and total sales |
| GET | `/api/orders` | All valid stored orders |
| GET | `/api/orders/<order_id>` | Order with items, or JSON 404 |
| GET | `/api/errors` | Structured errors read from `logs/errors.log` |
| GET | `/api/customers/summary` | Customer totals, highest first |

Successful requests return 200. Processing is a repeatable batch operation, so returns 200 rather than resource-creation status 201. Bad source input returns 400; missing resources return 404; wrong methods return 405; unexpected failures return JSON 500 with details logged only in the backend console.

```bash
curl http://127.0.0.1:5000/api/summary
curl -X POST http://127.0.0.1:5000/api/process
curl http://127.0.0.1:5000/api/orders/101
```

## Sample output and dashboard

```text
========================================
       ORDER PROCESSING SYSTEM
========================================

Processing orders...

Order 101: VALID - Total = 850.00
Order 102: VALID - Total = 450.00
Order 103: INVALID - Customer is required
Order 104: INVALID - Item 1: qty must be a positive number
Order 105: INVALID - Item 1: rate is required
Order 106: INVALID - Items must be a non-empty list
Order 107: INVALID - Item 1: qty must be a positive number
Order 108: VALID - Total = 273.00

========================================
SUMMARY
========================================

Valid Orders   : 3
Invalid Orders : 5

TOTAL PER CUSTOMER

Ravi Stores         : 1123.00
ABC Mart            : 450.00
```

Dashboard: **8 total · 3 valid · 5 invalid · ₹1,573.00 total sales**. Ravi Stores totals ₹1,123.00 and ABC Mart ₹450.00. The illustrative ₹1,823.00 in the brief does not match these item amounts; all displayed numbers are calculated, never hardcoded.

## Handling invalid orders

`validator.py` returns human-readable reasons. `processor.py` collects those reasons and continues to the next order, without inserting the invalid order or its items. `logger.py` uses Python logging to write one JSON object per invalid order, including a readable description such as `Order 103: Customer is required`. JSON lines safely escape line breaks and preserve structured IDs. `/api/errors` reads this file directly. Fix `orders.json` and click **Process Orders** to replace the batch with corrected results.

## Verification

```bash
cd backend
source venv/bin/activate
python3 -m unittest -v

# In frontend/
npm run build
```

The backend suite checks sample calculations and logs, repeated processing, empty input, duplicates, malformed entries, numeric edge cases, invalid sources, foreign keys, transaction rollback, JSON error responses, and CORS. The frontend build checks the React/Vite/Tailwind integration.

Live verification also passed for every API endpoint, JSON 404s, real HTTP URL input, and the Vite API proxy. Automated Chrome checks confirmed API-driven statistics, all five validation errors, customer totals, order details, Close/Escape, Process Orders, Refresh, mobile layout without page overflow, and the backend-unavailable message, with no browser exceptions.
