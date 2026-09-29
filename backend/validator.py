"""Small, explicit validation functions; booleans are not numbers here."""
import math


def positive_number(value):
    try:
        return type(value) in (int, float) and value > 0 and math.isfinite(value)
    except OverflowError:
        return False


def validate_order(order):
    errors = []
    if not isinstance(order, dict):
        return ['Order must be an object']
    if 'order_id' not in order:
        errors.append('Order ID is required')
    elif type(order['order_id']) is not int or not -(2**63) <= order['order_id'] < 2**63:
        errors.append('Order ID must be an integer within SQLite range')
    if not isinstance(order.get('customer'), str) or not order['customer'].strip():
        errors.append('Customer is required')
    if not isinstance(order.get('items'), list) or not order['items']:
        errors.append('Items must be a non-empty list')
        return errors
    for index, item in enumerate(order['items'], 1):
        prefix = f'Item {index}: '
        if not isinstance(item, dict):
            errors.append(prefix + 'must be an object')
            continue
        if not isinstance(item.get('product'), str) or not item['product'].strip():
            errors.append(prefix + 'product is required')
        for field in ('qty', 'rate'):
            if field not in item:
                errors.append(prefix + field + ' is required')
            elif not positive_number(item[field]):
                errors.append(prefix + field + ' must be a positive number')
    return errors
