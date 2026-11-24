import urllib.request
import json

url = 'https://pzkqjdkphcwmblbyorbr.supabase.co/auth/v1/token?grant_type=password'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE'

test_users = [
    ('admin@empresa.com', 'admin123', 'SuperAdmin'),
    ('jhesus434@gmail.com', 'admin5876', 'Supervisor'),
    ('frades@impress.com', 'user123', 'Operador'),
    ('rixys@impress.com', 'user123', 'Supervisor'),
    ('josfer@impress.com', 'user123', 'Informatico'),
]

for email, pwd, role_desc in test_users:
    payload = json.dumps({'email': email, 'password': pwd}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'apikey': anon_key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            uid = res['user']['id'][:8]
            print(f"[OK] {email} ({role_desc}): Auth OK, UID: {uid}")
    except urllib.error.HTTPError as e:
        print(f"[FAIL] {email} ({role_desc}): {e.code} - {e.read().decode('utf-8')}")
