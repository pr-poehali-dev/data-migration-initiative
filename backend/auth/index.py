import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''API для регистрации, входа и проверки сессий пользователей'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    
    try:
        path = event.get('queryStringParameters', {}).get('action', '')
        
        if method == 'POST' and path == 'register':
            return handle_register(event, conn)
        elif method == 'POST' and path == 'login':
            return handle_login(event, conn)
        elif method == 'GET' and path == 'me':
            return handle_me(event, conn)
        else:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Not found'}),
                'isBase64Encoded': False
            }
    finally:
        conn.close()

def handle_register(event: dict, conn) -> dict:
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    full_name = data.get('full_name', '')
    role = data.get('role', 'partner')
    
    if not email or not password:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Email и пароль обязательны'}),
            'isBase64Encoded': False
        }
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    referral_code = secrets.token_urlsafe(8)
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(
            "INSERT INTO users (email, password_hash, full_name, role, referral_code) VALUES (%s, %s, %s, %s, %s) RETURNING id, email, full_name, role, referral_code, balance, created_at",
            (email, password_hash, full_name, role, referral_code)
        )
        user = cur.fetchone()
        conn.commit()
        
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=30)
        
        cur.execute(
            "INSERT INTO sessions (user_id, session_token, expires_at) VALUES (%s, %s, %s)",
            (user['id'], session_token, expires_at)
        )
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'user': dict(user),
                'session_token': session_token
            }, default=str),
            'isBase64Encoded': False
        }
    except psycopg2.IntegrityError:
        conn.rollback()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Пользователь с таким email уже существует'}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()

def handle_login(event: dict, conn) -> dict:
    data = json.loads(event.get('body', '{}'))
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Email и пароль обязательны'}),
            'isBase64Encoded': False
        }
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(
            "SELECT id, email, full_name, role, referral_code, balance, created_at FROM users WHERE email = %s AND password_hash = %s",
            (email, password_hash)
        )
        user = cur.fetchone()
        
        if not user:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Неверный email или пароль'}),
                'isBase64Encoded': False
            }
        
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=30)
        
        cur.execute(
            "INSERT INTO sessions (user_id, session_token, expires_at) VALUES (%s, %s, %s)",
            (user['id'], session_token, expires_at)
        )
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'user': dict(user),
                'session_token': session_token
            }, default=str),
            'isBase64Encoded': False
        }
    finally:
        cur.close()

def handle_me(event: dict, conn) -> dict:
    headers = event.get('headers', {})
    session_token = headers.get('x-session-token') or headers.get('X-Session-Token')
    
    if not session_token:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Не авторизован'}),
            'isBase64Encoded': False
        }
    
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(
            "SELECT u.id, u.email, u.full_name, u.role, u.referral_code, u.balance, u.created_at FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.session_token = %s AND s.expires_at > NOW()",
            (session_token,)
        )
        user = cur.fetchone()
        
        if not user:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Сессия истекла'}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'user': dict(user)}, default=str),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
