import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''API для пополнения, вывода и просмотра транзакций криптовалюты'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    
    try:
        headers = event.get('headers', {})
        session_token = headers.get('x-session-token') or headers.get('X-Session-Token')
        
        if not session_token:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Не авторизован'}),
                'isBase64Encoded': False
            }
        
        user_id = get_user_id_by_session(conn, session_token)
        
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Сессия истекла'}),
                'isBase64Encoded': False
            }
        
        path = event.get('queryStringParameters', {}).get('action', '')
        
        if method == 'POST' and path == 'deposit':
            return handle_deposit(event, conn, user_id)
        elif method == 'POST' and path == 'withdraw':
            return handle_withdraw(event, conn, user_id)
        elif method == 'GET' and path == 'transactions':
            return handle_transactions(conn, user_id)
        elif method == 'POST' and path == 'confirm':
            return handle_confirm_transaction(event, conn, user_id)
        else:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Not found'}),
                'isBase64Encoded': False
            }
    finally:
        conn.close()

def get_user_id_by_session(conn, session_token: str):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT user_id FROM sessions WHERE session_token = %s AND expires_at > NOW()",
            (session_token,)
        )
        result = cur.fetchone()
        return result['user_id'] if result else None
    finally:
        cur.close()

def handle_deposit(event: dict, conn, user_id: int) -> dict:
    data = json.loads(event.get('body', '{}'))
    amount = float(data.get('amount', 0))
    currency = data.get('currency', 'USDT')
    
    if amount <= 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Сумма должна быть больше 0'}),
            'isBase64Encoded': False
        }
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        platform_wallet = "TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
        
        cur.execute(
            "INSERT INTO transactions (user_id, type, amount, currency, status, wallet_address, description) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at",
            (user_id, 'deposit', amount, currency, 'pending', platform_wallet, 'Пополнение баланса')
        )
        transaction = cur.fetchone()
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'transaction_id': transaction['id'],
                'wallet_address': platform_wallet,
                'amount': amount,
                'currency': currency,
                'status': 'pending',
                'message': 'Переведите средства на указанный адрес'
            }, default=str),
            'isBase64Encoded': False
        }
    finally:
        cur.close()

def handle_withdraw(event: dict, conn, user_id: int) -> dict:
    data = json.loads(event.get('body', '{}'))
    amount = float(data.get('amount', 0))
    wallet_address = data.get('wallet_address', '').strip()
    currency = data.get('currency', 'USDT')
    
    if amount <= 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Сумма должна быть больше 0'}),
            'isBase64Encoded': False
        }
    
    if not wallet_address:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Укажите адрес кошелька'}),
            'isBase64Encoded': False
        }
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("SELECT balance FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        
        if not user or float(user['balance']) < amount:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Недостаточно средств'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "UPDATE users SET balance = balance - %s WHERE id = %s",
            (amount, user_id)
        )
        
        cur.execute(
            "INSERT INTO transactions (user_id, type, amount, currency, status, wallet_address, description) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at",
            (user_id, 'withdraw', amount, currency, 'processing', wallet_address, 'Вывод средств')
        )
        transaction = cur.fetchone()
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'transaction_id': transaction['id'],
                'amount': amount,
                'currency': currency,
                'wallet_address': wallet_address,
                'status': 'processing',
                'message': 'Заявка на вывод принята, средства будут переведены в течение 24 часов'
            }, default=str),
            'isBase64Encoded': False
        }
    finally:
        cur.close()

def handle_transactions(conn, user_id: int) -> dict:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(
            "SELECT id, type, amount, currency, status, wallet_address, tx_hash, description, created_at FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
            (user_id,)
        )
        transactions = cur.fetchall()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'transactions': [dict(t) for t in transactions]}, default=str),
            'isBase64Encoded': False
        }
    finally:
        cur.close()

def handle_confirm_transaction(event: dict, conn, user_id: int) -> dict:
    data = json.loads(event.get('body', '{}'))
    transaction_id = data.get('transaction_id')
    tx_hash = data.get('tx_hash', '').strip()
    
    if not transaction_id or not tx_hash:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Укажите ID транзакции и хеш'}),
            'isBase64Encoded': False
        }
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(
            "SELECT id, amount, type FROM transactions WHERE id = %s AND user_id = %s AND status = 'pending'",
            (transaction_id, user_id)
        )
        transaction = cur.fetchone()
        
        if not transaction:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Транзакция не найдена'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "UPDATE transactions SET status = %s, tx_hash = %s, updated_at = NOW() WHERE id = %s",
            ('completed', tx_hash, transaction_id)
        )
        
        if transaction['type'] == 'deposit':
            cur.execute(
                "UPDATE users SET balance = balance + %s WHERE id = %s",
                (transaction['amount'], user_id)
            )
        
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Транзакция подтверждена'}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
