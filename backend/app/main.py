"""Houston To-Do API - in-memory todo list backend"""

import uuid
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

app = FastAPI(title="Houston To-Do API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


### In-memory data store ###
users: dict[str, dict] = {}       # email -> user data# email -> {id, name, email, password}
tokens: dict[str, str] = {}       # token -> user_id
tasks: dict[str, dict] = {}       # task_id -> task_id -> {id, description, completed, owner, position}


### Pydantic models ###
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=4, max_length=128) # Short for demo purposes only, do not use in production

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TaskCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)

class TaskUpdate(BaseModel):
    description: str | None = None
    completed: bool | None = None

class ReorderRequest(BaseModel):
    task_ids: list[str]


### Authentication dependency ###
def get_current_user(authorization: str = Header(...)) -> dict:
    """Extract user from Bearer token"""
    token = authorization.replace("Bearer ", "")
    user_id = tokens.get(token)
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = next((u for u in users.values() if u["id"] == user_id), None)
    if not user:
        raise HTTPException(401, "User not found")
    return user


### API Endpoints ###

#### Authentication Endpoints ####
@app.post("/api/auth/register")
def register(body: UserCreate):
    if body.email in users:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    users[body.email] = {
        "id": user_id,
        "name": body.name,
        "email": body.email,
        "password": body.password,  # Not hashed for demo purposes only, in production hash this
    }
    token = str(uuid.uuid4())
    tokens[token] = user_id
    return {"token": token}

@app.post("/api/auth/login")
def login(body: UserLogin):
    user = users.get(body.email)
    if not user or user["password"] != body.password:
        raise HTTPException(401, "Invalid email or password")
    token = str(uuid.uuid4())
    tokens[token] = user["id"]
    return {"token": token}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
    }

@app.post("/api/auth/logout")
def logout(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    tokens.pop(token, None)
    return {"message": "Logged out successfully"}


#### Task Endpoints ####
@app.post("/api/tasks", status_code=201)
def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    # Position = count of user's existing tasks (append to end)
    user_tasks = [t for t in tasks.values() if t["owner"] == user["id"]]
    tasks[task_id] = {
        "id": task_id,
        "description": body.description,
        "completed": False,
        "owner": user["id"],
        "position": len(user_tasks),
    }
    return tasks[task_id]

@app.get("/api/tasks")
def list_tasks(
    completed: bool | None = None,
    user: dict = Depends(get_current_user),
):
    user_tasks = [t for t in tasks.values() if t["owner"] == user["id"]]
    if completed is not None:
        user_tasks = [t for t in user_tasks if t["completed"] == completed]
    # Sort by position
    return sorted(user_tasks, key=lambda t: t["position"])

@app.get("/api/tasks/{task_id}")
def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = tasks.get(task_id)
    if not task or task["owner"] != user["id"]:
        raise HTTPException(404, "Task not found")
    return task

@app.put("/api/tasks/{task_id}")
def update_task(
    task_id: str,
    body: TaskUpdate,
    user: dict = Depends(get_current_user)
):
    task = tasks.get(task_id)
    if not task or task["owner"] != user["id"]:
        raise HTTPException(404, "Task not found")
    if body.description is not None:
        task["description"] = body.description
    if body.completed is not None:
        task["completed"] = body.completed
    return task

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    task = tasks.get(task_id)
    if not task or task["owner"] != user["id"]:
        raise HTTPException(404, "Task not found")
    del tasks[task_id]

@app.put("/api/tasks/reorder")
def reorder_tasks(body: ReorderRequest, user: dict = Depends(get_current_user)):
    for i, task_id in enumerate(body.task_ids):
        task = tasks.get(task_id)
        if task and task["owner"] == user ["id"]:
            task["position"] = i
    return {"message": "Tasks reordered successfully"}
