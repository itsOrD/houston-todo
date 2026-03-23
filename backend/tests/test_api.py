"""Tests for Houston API — AI account mission control.

# TODO: Given more time, expand test coverage:
# - test_update_task_description
# - test_update_task_completed_toggle
# - test_filter_tasks_by_completed
# - test_reorder_tasks_persists_positions
# - test_account_credit_boundaries (0 and max)
# - test_account_update_all_fields
# - test_delete_account_removes_from_list
# - test_concurrent_credit_updates
# - test_invalid_token_returns_401
# - test_cross_user_account_access_blocked (IDOR)
# - test_register_duplicate_email_returns_400
# - test_task_with_invalid_account_id
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app, users, tokens, tasks, accounts


@pytest.fixture(autouse=True)
def clear_stores():
    """Reset in-memory stores between tests."""
    users.clear()
    tokens.clear()
    tasks.clear()
    accounts.clear()
    yield


client = TestClient(app)


def register_and_login(name="Test", email="test@test.com", password="pass1234"):
    """Helper — register a user and return their auth header."""
    res = client.post("/api/auth/register", json={
        "name": name, "email": email, "password": password,
    })
    return {"Authorization": f"Bearer {res.json()['token']}"}


class TestAuth:
    def test_register_returns_token(self):
        res = client.post("/api/auth/register", json={
            "name": "A", "email": "a@b.com", "password": "pass1234",
        })
        assert res.status_code == 200
        assert "token" in res.json()

    def test_login_returns_token(self):
        register_and_login()
        res = client.post("/api/auth/login", json={
            "email": "test@test.com", "password": "pass1234",
        })
        assert res.status_code == 200
        assert "token" in res.json()

    def test_login_wrong_password(self):
        register_and_login()
        res = client.post("/api/auth/login", json={
            "email": "test@test.com", "password": "wrong",
        })
        assert res.status_code == 401

    def test_get_me(self):
        headers = register_and_login()
        res = client.get("/api/auth/me", headers=headers)
        assert res.status_code == 200
        assert res.json()["email"] == "test@test.com"


class TestTasks:
    def test_create_task(self):
        headers = register_and_login()
        res = client.post("/api/tasks", json={"description": "Buy milk"}, headers=headers)
        assert res.status_code == 201
        assert res.json()["description"] == "Buy milk"
        assert res.json()["completed"] is False

    def test_list_tasks(self):
        headers = register_and_login()
        client.post("/api/tasks", json={"description": "Task 1"}, headers=headers)
        client.post("/api/tasks", json={"description": "Task 2"}, headers=headers)
        res = client.get("/api/tasks", headers=headers)
        assert len(res.json()) == 2

    def test_delete_task(self):
        headers = register_and_login()
        task = client.post("/api/tasks", json={"description": "Test"}, headers=headers).json()
        res = client.delete(f"/api/tasks/{task['id']}", headers=headers)
        assert res.status_code == 204

    def test_tenant_isolation(self):
        h1 = register_and_login(email="user1@test.com")
        h2 = register_and_login(email="user2@test.com")
        client.post("/api/tasks", json={"description": "User1 task"}, headers=h1)
        assert len(client.get("/api/tasks", headers=h2).json()) == 0


class TestAccounts:
    def test_create_account(self):
        headers = register_and_login()
        res = client.post("/api/accounts", json={
            "name": "Claude", "credits_total": 100,
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Claude"
        assert res.json()["credits_used"] == 0

    def test_update_credits(self):
        headers = register_and_login()
        acct = client.post("/api/accounts", json={
            "name": "ChatGPT", "credits_total": 50,
        }, headers=headers).json()
        res = client.put(f"/api/accounts/{acct['id']}", json={
            "credits_used": 10,
        }, headers=headers)
        assert res.json()["credits_used"] == 10

    def test_task_with_account(self):
        headers = register_and_login()
        acct = client.post("/api/accounts", json={
            "name": "Claude", "credits_total": 100,
        }, headers=headers).json()
        task = client.post("/api/tasks", json={
            "description": "Use Claude", "account_id": acct["id"],
        }, headers=headers).json()
        assert task["account_id"] == acct["id"]
