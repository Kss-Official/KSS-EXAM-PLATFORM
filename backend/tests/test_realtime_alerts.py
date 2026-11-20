import requests
import json
import time

API_BASE = "http://127.0.0.1:8000"

# 1. Admin Login
r_admin = requests.post(f"{API_BASE}/api/auth/login", json={
    "email": "d.koushik@kalpanaaasoftwaresolutions.in",
    "password": "Admin@ExamSecure2026!"
})
admin_token = r_admin.json().get("token")
auth_headers = {"Authorization": f"Bearer {admin_token}"}

# Check initial alerts count
r_examinees_init = requests.get(f"{API_BASE}/api/admin/live-monitoring/examinees", headers=auth_headers).json()
r_alerts_init = requests.get(f"{API_BASE}/api/admin/live-monitoring/alerts", headers=auth_headers).json()
initial_alert_count = len(r_alerts_init)
print(f"Initial Total Alerts in System: {initial_alert_count}")

# 2. Candidate login (Candidate Priya Patel or Jingyasa)
# Candidate Priya Patel (candidateId: 3400)
cand_id = 3400
# Generate token or post alert directly
r_alert1 = requests.post(f"{API_BASE}/api/candidate/proctor/alert", json={
    "candidateId": cand_id,
    "alertType": "TAB_SWITCH",
    "message": "Candidate minimized browser or switched tabs to ChatGPT",
    "severity": "HIGH"
})
print("Alert 1 (TAB_SWITCH) Posted:", r_alert1.status_code, r_alert1.text)

time.sleep(1)

r_alert2 = requests.post(f"{API_BASE}/api/candidate/proctor/alert", json={
    "candidateId": cand_id,
    "alertType": "CLIPBOARD_COPY",
    "message": "Candidate attempted to copy question text to clipboard",
    "severity": "HIGH"
})
print("Alert 2 (CLIPBOARD_COPY) Posted:", r_alert2.status_code, r_alert2.text)

time.sleep(1)

r_alert3 = requests.post(f"{API_BASE}/api/candidate/proctor/alert", json={
    "candidateId": cand_id,
    "alertType": "MULTI_FACE",
    "message": "Multiple individuals detected in webcam feed by AI proctor",
    "severity": "CRITICAL"
})
print("Alert 3 (MULTI_FACE) Posted:", r_alert3.status_code, r_alert3.text)

# 3. Immediately query Live Monitoring Examinees & Alerts
r_examinees_after = requests.get(f"{API_BASE}/api/admin/live-monitoring/examinees", headers=auth_headers).json()
r_alerts_after = requests.get(f"{API_BASE}/api/admin/live-monitoring/alerts?limit=10", headers=auth_headers).json()

new_alert_count = len(r_alerts_after)
print(f"\nNew Alert Count: {new_alert_count} (Increased by {new_alert_count - initial_alert_count})")
print("Top 3 Most Recent Alerts in Live Feed:")
for al in r_alerts_after[:3]:
    print(f"  🚨 [{al.get('severity')}] {al.get('alertType')} - {al.get('candidateName')} ({al.get('registrationNumber')}): {al.get('message')}")

cand_in_table = next((e for e in r_examinees_after if e.get("candidateId") == cand_id), None)
if cand_in_table:
    print(f"\nCandidate in Table: {cand_in_table.get('fullName')} | Realtime Alerts Count: {cand_in_table.get('alertsCount')}")

